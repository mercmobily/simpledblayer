/*
Copyright (C) 2013 Tony Mobily

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var 
  dummy

, declare = require('simpledeclare')
, async = require('async')
;

var consolelog = function(){
  //console.log.apply( console, arguments );
}


var SimpleDbLayer = declare( null, {

  db: null,

  schema: {},
  SchemaError: Error,
  
  childrenTablesHash: {},
  lookupChildrenTablesHash: {},
  multipleChildrenTablesHash: {},
  parentTablesArray: [],

  _permutationGroups: {},
  _permutationPrefixes: {},
  _searchableHash: {},
  _sortableHash: {},

  positionField: null,
  positionBase: [],

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

    // idProperty needs to be defined, AND it needs to be defined in the schema
    // Plus, make sure it's required
    if( typeof( options.idProperty ) === 'undefined' ){
      throw( new Error("SimpleDbLayer's constructor requires an 'idProperty' in options") );
    }
    if( typeof( options.schema.structure[ options.idProperty ] ) === 'undefined' ){
      throw( new Error("idProperty needs to be a field in the schema") );
    }
    // idProperty NEEDS to be required and searchable
    options.schema.structure[ options.idProperty ].required = true;
    options.schema.structure[ options.idProperty ].searchable = true;

    // Assigning positionField and positionBase
    if( typeof( options.positionField ) !== 'undefined' ){
      self.positionField = options.positionField;
    }
    if( typeof( options.positionBase ) !== 'undefined' ){
      self.positionBase = options.positionBase;
    }
 
    // Gets its own variables, avoid using the ptototype
    self.childrenTablesHash = {};
    self.lookupChildrenTablesHash = {};
    self.multipleChildrenTablesHash = {};
    self.parentTablesArray = [];

    self._permutationGroups = { __main: { prefixes: {}, fields: {} } };
    self._searchableHash = {};
    self._sortableHash = {};

    // Add entries to _searchableHash: add whichever field is marked as "searchable" or "permute" in the
    // schema.
    // This will assign either `true`, or `upperCase` (for strings)
    Object.keys( options.schema.structure ).forEach( function( field ) {
      var entry = options.schema.structure[ field ];

      var entryType = entry.type === 'string' ? 'upperCase' : true;

      if( entry.sortable )                           self._sortableHash[ field ] = true;
      if( entry.searchable )                         self._searchableHash[ field ] = entryType;
      if( entry.searchable && entry.permute )        self._permutationGroups.__main.fields[ field ] = entryType;
      if( entry.searchable && entry.permutePrefix )  self._permutationGroups.__main.prefixes[ field ] = entryType;
    });

    // Give a sane default to options.nested
    if( !Array.isArray( options.nested ) ) options.nested = [];

    // Allow passing of SchemaError as an option. This error will be thrown when
    // the schema doesn't pass validation, with the `error` hash set
    if( options.SchemaError ){
      self.SchemaError = options.SchemaError;
    }

    // Allow passing of hardLimitOfQuery as an option.
    if( options.hardLimitOnQueries ){
      self.hardLimitOnQueries = options.hardLimitOnQueries;
    }

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

    // Set the object's attributes: schema, nested, table
    self.schema = options.schema;
    self.idProperty = options.idProperty;
    self.nested = options.nested;
    self.table = table;


    if( typeof( SimpleDbLayer.registry ) === 'undefined' ) SimpleDbLayer.registry = {}; 
    // Add this very table to the registry
    SimpleDbLayer.registry[ table ] = self;
  },


  _makeTablesHashes: function(){

    var self = this;
    var parent = self;

    // Make up all table hashes and arrays

    consolelog("\nScanning initiated for ", self.table );

    self.nested.forEach( function( childNestedParams ){

      // The parameter childNestedParams.layer is a string. It needs to be
      // converted to a proper table, now that they are all instantiated.
      childNestedParams.layer = SimpleDbLayer.registry[ childNestedParams.layer ];

      var childLayer = childNestedParams.layer;

      consolelog("\nScanning", parent.table, ", nested table:", childNestedParams.layer.table, ", nested params:", childNestedParams );
      consolelog("It has a parent. Setting info for", parent.table );

      // Important check that parentField is actually set
      if( childNestedParams.type == 'lookup' && typeof( childNestedParams.parentField ) === 'undefined' ){
        throw( new Error( "parentField needs to be set for type lookup" ) );
      }

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
      self.childrenTablesHash[ subName ] =  thisLayerObject;
      if( childNestedParams.type === 'lookup' ) self.lookupChildrenTablesHash[ subName ] = thisLayerObject;
      if( childNestedParams.type === 'multiple' ) self.multipleChildrenTablesHash [ subName ] = thisLayerObject;

      // Adding this parent to the child
      // (Just an array, since it's just a generic list of fathers)

      consolelog("Adding", self.table, " as a parent of", childLayer.table );

      childLayer.parentTablesArray.push( { layer: self, nestedParams: childNestedParams } );

      consolelog("The child Layer", childLayer.table, "at this point has the following parents: ", childLayer.parentTablesArray );

      // Add more entries to _searchableHash and _permutationGroups: _all_ fields that are searchable/permutable
      // in a child record
      consolelog("Adding entries to father's _searchableHash to make sure that searchable children fields are searchable");
      var field;
      if( childNestedParams.type === 'lookup' ) field = childNestedParams.parentField;
      if( childNestedParams.type === 'multiple' ) field = childLayer.table;
      consolelog( 'Considering field ', field, "for table: ", childLayer.table );

      Object.keys( childLayer.schema.structure ).forEach( function( k ){

        var entry = childLayer.schema.structure[ k ];
        var entryType = entry.type === 'string' ? 'upperCase' : true;

        consolelog( "Field:" , k, ", Entry for that field: -- type: ", entryType );
        consolelog( entry );

        if( entry.searchable && entry.permute ){
          self._permutationGroups[ field ] = self._permutationGroups[ field ] || { prefixes: {}, fields: {} };
          self._permutationGroups[ field ].fields[ field + '.' + k ] = entryType;

          consolelog("Field is permutable!" );
        }

        if( entry.searchable && entry.permutePrefix ){
          self._permutationGroups[ field ] = self._permutationGroups[ field ] || { prefixes: {}, fields: {} };
          self._permutationGroups[ field ].prefixes[ field + '.' + k ] = entryType;

          consolelog("Field is a prefix for permutable!" );
        }
 
        // If entry is searchable, add the field to the _searchableHash
        if( entry.searchable ){
          self._searchableHash[ field + "." + k ] = entryType;

          consolelog("Field is searchable! So: ", field + "." + k, "will be searchable in father table" );
        }

        // If entry is sortable, add the field to the _sortableHash
        if( entry.sortable ){
          self._sortableHash[ field + "." + k ] = entryType;

          consolelog("Field is sortable! So: ", field + "." + k, "will be sortable in father table" );
        }

      }); 
      
      consolelog("Making sure that join keys are searchable:" );

      // Makes sure that nested tables have ALL of the right indexes
      // so that joins always work
      if( childNestedParams.type === 'lookup' ) var field = childNestedParams.parentField;
      else var field = childNestedParams.layer;

      Object.keys( childNestedParams.join ).forEach( function( key ){
        consolelog( "Forcing ", key, 'in table', childLayer.table, 'to be searchable' );
        childLayer._searchableHash[ key ] = true;
      });

      consolelog("Parents searchable hash after cure:", parent._searchableHash );

      // Create permutation groups for indexing
    });
    consolelog("End of scanning");

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


  // Handy function when creating permuted indexes

  _permute: function( input ){
    // THANK YOU http://stackoverflow.com/questions/9960908/permutations-in-javascript
    // Permutation function
    var permArr = [],
    usedChars = [];
    function main( input ){
      var i, ch;
      for (i = 0; i < input.length; i++) {
        ch = input.splice(i, 1)[0];
        usedChars.push(ch);
        if (input.length == 0) {
          permArr.push( usedChars.slice() );
        }
        main( input );
        input.splice( i, 0, ch );
        usedChars.pop();
      }
      return permArr;
    }
    return main(input);
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

  reposition: function( record, moveBeforeId, cb ){
    if( typeof( cb ) === 'undefined' ) cb = function(){};

    cb( null );
  },


  makeIndex: function( keys, name, options, cb ){
    cb( null );
  },

  dropIndex: function( name, cb ){
    cb( null );
  },

  dropAllIndexes: function( cb ){
    cb( null );
  },


  generateSchemaIndexes: function( options, cb ){
    cb( null );
  },


});

// Initialise all layers, creating relationship hashes
SimpleDbLayer.initLayers = function(){
  Object.keys( SimpleDbLayer.registry ).forEach( function( key ){
    var table = SimpleDbLayer.registry[ key ];
    table._makeTablesHashes();
  });
}
// Get layer from the class' registry
SimpleDbLayer.getLayer = function( tableName ){
  return SimpleDbLayer.registry[ tableName ];
}

// Get all layers as a hash
SimpleDbLayer.getAllLayers = function(){
  return SimpleDbLayer.registry;
}

SimpleDbLayer.generateSchemaIndexesAllLayers = function( options, cb ){

  // This will contain the array of functions, one per layer
  var indexMakers = [];

  // Add one item to indexMakers for each table to reindex
  Object.keys( SimpleDbLayer.getAllLayers() ).forEach( function( table ){

    var layer = SimpleDbLayer.getLayer( table );
    
    indexMakers.push( function( cb ){
      layer.generateSchemaIndexes( options, cb );
    });

  });

  async.series( indexMakers, cb );
}

SimpleDbLayer.dropAllIndexesAllLayers = function( options, cb ){

  // This will contain the array of functions, one per layer
  var indexMakers = [];

  // Add one item to indexMakers for each table to reindex
  Object.keys( SimpleDbLayer.getAllLayers() ).forEach( function( table ){

    var layer = SimpleDbLayer.getLayer( table );
    
    indexMakers.push( function( cb ){
      layer.dropAllIndexes( cb );
    });

  });

  async.series( indexMakers, cb );
}


exports = module.exports = SimpleDbLayer;


