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
  
  childrenTablesHash: {},
  lookupChildrenTablesHash: {},
  multipleChildrenTablesHash: {},
  parentTablesArray: {},

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

    // Make up all table hashes and arrays

    self.childrenTablesHash = {};
    self.lookupChildrenTablesHash = {};
    self.multipleChildrenTablesHash = {};
    self.parentTablesArray = [];
 
    var master = self;

    function scanNested( childLayer, parent, childNestedParams ){

      // Add the table as a subtable
      if( parent !== null ){

        // Work out subName, depending on the type of the child.
        // - For multiple 1:n children, the subName can just be the child's table name
        // - For single lookups, since there can be more children lookups pointing to the same table,
        //   the key will need to be the parentField name
        // This way, each record will have a list of children with a unique key, which will either
        // lead to a lookup or a multiple relationship.
        var subName;
        switch( childNestedParams.type ){
          case 'multiple': subName = childLayer.table; break;
          case 'lookup': subName = childNestedParams.parentField; break;
        }

        // Adding this child to the parent
        // (With the right subkey)

        var thisLayerObject = { layer: childLayer, nestedParams: childNestedParams };
        parent.childrenTablesHash[ subName ] =  thisLayerObject;
        if( childNestedParams.type === 'lookup' ) parent.lookupChildrenTablesHash[ subName ] = thisLayerObject;
        if( childNestedParams.type === 'multiple' ) parent.multipleChildrenTablesHash [ subName ] = thisLayerObject;

        // Adding this parent to the child
        // (Just an array, since it's just a generic list of fathers)

        childLayer.parentTablesArray.push( { layer: parent, nestedParams: childNestedParams } );
 
      }

      //console.log( "R OBJECT IS: ", layer.table, require('util').inspect( layer, { depth: 2 }  )  );
      //if( layer.nested.length ) console.log("THERE ARE NESTED!");

      childLayer.nested.forEach( function( np ){
        scanNested( np.layer, childLayer, np );
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


