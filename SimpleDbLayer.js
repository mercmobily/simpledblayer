/*
Copyright (C) 2013 Tony Mobily

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var 
  dummy

, declare = require('simpledeclare')
;

var SimpleDbLayer = declare( null, {

  db: null,

  schema: {},
  searchSchema: {},
  SchemaError: Error,
  
  allTablesHash: {},
  childrenTablesHash: {},
  autoLoadTablesHash: {},
  searchableTablesHash: {},
  keywordTablesHash: {},
  parentTablesHash: {},

  table: '',
  childrenField: '_children',

  hardLimitOnQueries: 0,

  constructor: function( table,  options, db ){

    var self = this;

    // Get 'options' ready
    if( typeof( options ) === 'undefined' || options == null ) options = {};

    // table needs to be defined
    if( typeof( table ) === 'undefined' ){
      throw( new Error("SimpleDbLayer's constructor requires the 'table' parameter in its constructor") );
    }

    // schema needs to be defined
    if( typeof( options.schema ) === 'undefined' ){
      throw( new Error("SimpleDbLayer's constructor requires a 'schema' in options") );
    }

    // Allow passing of SchemaError as an option. This error will be thrown when
    // the schema doesn't pass validation, with the `error` hash set
    if( options.SchemaError ){
      self.SchemaError = options.SchemaError;
    }

    // options.ref needs to be a non-null object
    if( typeof( options.ref ) === 'undefined' || options.ref == null ) options.ref = {};
 
    // The `db` attribute can be passed to the constructor, or mixed in in advance
    // Check that the class has 'db' set (prototype, or coming from the constructor)
    if( typeof( db ) !== 'undefined' ){
      self.db = db;
    }
    if( typeof( self.db ) === 'undefined' ){
      throw( new Error("SimpleDbLayer's constructor need to have 'db' in their prototype") );
    }


    // Check that the same table is not managed by two different db layers
    // Only ONE db layer per DB table
    //if( self.tableRegistry[ table ] ){
    //  throw new Error("Cannot instantiate two db objects on the same collection: " + table );
    //}
    //self.tableRegistry[ table ] = true;

    // Set the object's attributes: schema, searchSchema, table, ref
    self.schema = options.schema;
    self.searchSchema = typeof( options.searchSchema ) === 'undefined' || options.searchSchema === null ? self.schema : options.searchSchema;
    self.nested = options.nested || [];
    self.table = table;
   
    // Make up add ***TablesHash variables
    self._makeTableHashes();

  },


  _makeTableHashes: function(){

    var self = this;

    // Make up all table hashes
    self.allTablesHash = {};
    self.childrenTablesHash = {};
    //self.alertingSubTablesHash = {};
    self.autoLoadTablesHash = {};
    self.searchableTablesHash = {};
    self.keywordTablesHash = {};
    self.parentTablesHash = {};

 
    var master = self;

    function scanNested( layer, parent, nestedParams ){

      // Add the table as a subtable
      if( parent !== null ){

        // This layer's object, including layer and nestedParams
        var thisLayerObject = { layer: layer, nestedParams: nestedParams };

        // Includes all tables in the tree
        master.allTablesHash[ layer.table ] = thisLayerObject;

        // Includes all sub-tables directly below
        parent.childrenTablesHash[ layer.table ] = thisLayerObject;

        // Includes all sub-tables that will need to be loaded
        if( nestedParams.autoload ) parent.autoLoadTablesHash[ layer.table ] = thisLayerObject;

        if( nestedParams.alertParent ){

          // Includes all tables in the tree that will possibly alert in case of change
          //master.alertingSubTablesHash[ layer.table ] = thisLayerObject;

          // Includes for MASTER all tables that need to be alerted in cast of change
          //layer.toBeAlertedTablesHash[ master.table ] = master;
          
          layer.parentTablesHash[ parent.table ] = { layer: parent, nestedParams: nestedParams };
        }

        // Includes for MASTER all searchable tables
        if( nestedParams.searchable ) master.searchableTablesHash[ layer.table ] = thisLayerObject;
        
        // Includes for MASTER all tables containing keywords to be indexed
        if( nestedParams.keywords ) master.keywordTablesHash[ layer.table ] = thisLayerObject;
      }

      //console.log( "R OBJECT IS: ", layer.table, require('util').inspect( layer, { depth: 2 }  )  );
      //if( layer.nested.length ) console.log("THERE ARE NESTED!");

      layer.nested.forEach( function( nestedParams ){
        scanNested( nestedParams.layer, layer, nestedParams );
      });
    }
    scanNested( self, null, {} );

  },


  sanitizeRanges: function( ranges, skipHardLimitOnQueries ){
    var self = this

    var saneRanges = {};
    if( ! self.hardLimitOnQueries ) var hardLimitOnQueries = 0;
  
    saneRanges.from = 0;
    saneRanges.to = 0;
    saneRanges.limit = 0;
 
    if( typeof( ranges ) === 'object' && ranges !== null ){

      // Copy values over to saneRanges
      saneRanges.from = ranges.from || -1;
      saneRanges.to = ranges.to || -1;
      saneRanges.limit = ranges.limit || -1;

      var sr = saneRanges;

      // Sorry, no shortcuts here for now. Code will be optimised later
      // (maybe)

      // Case: Only "limit" is set
      // - Set "from" and "to"
      if( sr.from === -1 && sr.to === -1 && sr.limit !== -1 ){
        sr.from = 0;
        sr.to = sr.limit - 1;
       
      // Case: Only "from" is set
      // - Set "to" and "limit"
      } else if( sr.from !== -1 && sr.to === -1 && sr.limit === -1 ){
        sr.limit =  0;
        sr.to  = 0;
 
      // Case: Only "to" is set
      // - Set "from" and "limit"
      } else if( sr.from === -1 && sr.to !== -1 && sr.limit === -1 ){
        sr.from = 0;
        sr.limit =  saneRanges.to - saneRanges.from + 1;
 
      // Case: Only "from" and "limit" are set
      // - Set "to"
      } else if( sr.from !== -1 && sr.to === -1 && sr.limit !== -1 ){
        sr.to =  sr.from + sr.limit - 1;

      // Case: Only "from" and "to" are set
      // - Set "limit"
      } else if( sr.from !== -1 && sr.to !== -1 && sr.limit === -1 ){
        sr.limit =  saneRanges.to - saneRanges.from + 1;

      // Case: Only "to" and "limit" are set
      // - Set "from"
      } else if( sr.from === -1 && sr.to !== -1 && sr.limit !== -1 ){
        sr.from = 0;
      }

      // Make sure "limit" never goes over
      if(  sr.limit != 0 && sr.from + sr.limit - 1 > sr.to ){
        sr.limit =  sr.to - sr.from + 1;
      }

    }

    // Apply hard limit on queries if required to do so. Driver implementations
    // should only pass 'true' for non-cursor queries, to prevent huge toArray() on
    // a million records
    if( ! skipHardLimitOnQueries ){
      if( self.hardLimitOnQueries && ( saneRanges.limit === 0 || sr.limit > self.hardLimitOnQueries ) ){
        saneRanges.limit = self.hardLimitOnQueries;
      }
    }

    return saneRanges;

  },

  select: function( filters, options, cb ){

    // Usual drill
    if( typeof( cb ) === 'undefined' ){
      cb = options;
      options = {}
    } else if( typeof( options ) !== 'object' || options === null ){
      throw( new Error("The options parameter must be a non-null object") );
    }
     
    if( options.useCursor ){
      cb( null, { next: function( done ){ done( null, null ); } } );
    } else {
      cb( null, [] );
    }
       
  },

  update: function( filters, record, options, cb ){

    // Usual drill
    if( typeof( cb ) === 'undefined' ){
      cb = options;
      options = {}
    } else if( typeof( options ) !== 'object' || options === null ){
      throw( new Error("The options parameter must be a non-null object") );
    }
      
    if( options.returnRecord ){
      cb( null, record );
    } else {
      cb( null, null );
    }

  },

  insert: function( record, options, cb ){

    // Usual drill
    if( typeof( cb ) === 'undefined' ){
      cb = options;
      options = {}
    } else if( typeof( options ) !== 'object' || options === null ){
      throw( new Error("The options parameter must be a non-null object") );
    }

    if( options.returnRecord ){
      cb( null, record );
    } else {
      cb( null, null );
    }

  },

  'delete': function( filters, options, cb ){

    // Usual drill
    if( typeof( cb ) === 'undefined' ){
      cb = options;
      options = {}
    } else if( typeof( options ) !== 'object' || options === null ){
      throw( new Error("The options parameter must be a non-null object") );
    }

    cb( null, null );
  },

  relocation: function( positionField, record, afterRecord, cb ){
    // console.log("REPOSITIONING BASING IT ON ", positionField, "RECORD: ", record, "TO GO AFTER:", afterRecord );
    cb( null, 0 );
  },

  makeIndex: function( keys, options ){
    //console.log("Called UNIMPLEMENTED makeIndex in collection ", this.table, ". Keys: ", keys );
  },

  dropAllIndexes: function( ){
    //console.log("Called UNIMPLEMENTED dropAllIndexes in collection ", this.table, ". Keys: ", keys );
  },

});


exports = module.exports = SimpleDbLayer;


