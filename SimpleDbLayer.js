/*jslint node: true, laxcomma:true */
"use strict";

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
, debug = require('debug')
;

var consolelog = debug( 'simpledblayer:main');

var SimpleDbLayer = declare( null, {

  // Mandatory properties
  table: null,
  schema: null,
  idProperty: null,
  db: null,

  // Optional fields, defaults set here
  SchemaError: Error,
  positionField: null,
  positionBase: [],
  childrenField: '_children',
  nested: [],
  hardLimitOnQueries: 0,
  extraIndexes: [],
  indexBase: [],
  strictSchemaOnFetch: true,

  // Fields that will be redefined in constructor, here for aesthetic reasons 
  childrenTablesHash: {},
  lookupChildrenTablesHash: {},
  multipleChildrenTablesHash: {},
  parentTablesArray: [],
  _indexGroups: { },

  _searchableHash: {},

  constructor: function( options ){

    var self = this;

    options = options || {};

    // Mixin values from constructor.
    for( var k in options ){
      if( !options.hasOwnProperty( k ) ) continue; 
      self[ k ] = options[ k ];
    }

    // Make sure 'table', 'schema', 'db' exist in the object *somehow*
    [ 'table', 'schema', 'idProperty', 'db' ].forEach( function( k ){
      if( ! self[ k ] )
        throw( new Error("SimpleDbLayer's constructor requires " + k + " defined as attribute") );
    });

    // Check that schema has idProperty defined
    if( typeof( self.schema.structure[ self.idProperty ] ) === 'undefined' ){
      throw( new Error("idProperty needs to be a field in the schema") );
    }

    // idProperty NEEDS to be required and searchable, and (index-wise) unique
    self.schema.structure[ self.idProperty ].required = true;
    self.schema.structure[ self.idProperty ].searchable = true;
    self.schema.structure[ self.idProperty ].indexOptions = { unique: true };

    // positionBase elements NEED to be required and searchable
    self.positionBase.forEach( function( k ){
      if( typeof( self.schema.structure[ k ] ) === 'undefined' ){
        throw( new Error("Element in positionBase but not in schema: " + k ) );
      }
      self.schema.structure[ k ].required = true;
      self.schema.structure[ k ].searchable = true;
    });

    // Gets its own variables, avoid using the prototype's by accident
    self.childrenTablesHash = {};
    self.lookupChildrenTablesHash = {};
    self.multipleChildrenTablesHash = {};
    self.parentTablesArray = [];
   
    // Make up searchable hash and index group
    self._makeSearchableHashAndIndexGroups();
  },

  _makeSearchableHashAndIndexGroups: function( options ){

    var self = this;

    self._indexGroups = { __main: { indexes: {}, indexBase: self.indexBase } };

    self._searchableHash = {};
   
    // Add entries to _searchableHash and _indexGroups
    Object.keys( self.schema.structure ).forEach( function( field ) {
      var entry = self.schema.structure[ field ];

      // Add the searchable entry as a single index, and honouring the indexDirection, indexOptions and
      // indexName options in the schema
      if( entry.searchable ){

        self._searchableHash[ field ] = entry;

        // indexName and indexDirection can be changed by the schema definition
        var indexDirection = typeof( entry.indexDirection ) !== 'undefined' ? entry.indexDirection : 1;
        var indexName = typeof( entry.indexName ) !== 'undefined' ? entry.indexName : field;
        var indexOptions = typeof( entry.indexOptions ) !== 'undefined' ? entry.indexOptions : {};

        var newEntry = { fields: {}, options: indexOptions };
        newEntry.fields[ field ] = { entry: entry, direction: indexDirection };
        //newEntry[ field ] = entry;
        self._indexGroups.__main.indexes[ indexName ] = newEntry;
      }

    });
    
    // Add the extra indexes as defined in extraIndexes 
    Object.keys( self.extraIndexes ).forEach( function( indexName ) {
      var index = self.extraIndexes[ indexName ];

      var indexOptions = index.options;

      // Work out the index's keys. This is the same as the passed "keys", but rather than
      // something line `{ workspaceId: 1 }`, it's `{ workspaceId: { direction: 1, entry: { type: 'id' } } }`
      var fields = {};
      Object.keys( index.fields ).forEach( function( fieldName ){

        var entry = self.schema.structure[ fieldName ];

        var direction = index.fields[ fieldName ];
        fields[ fieldName ] = { entry: entry, direction: direction };
      });
      self._indexGroups.__main.indexes[ indexName ] = { extra: true, fields: fields, options: indexOptions };
    });



  },

  _makeTablesHashes: function(){

    var self = this;
    var parent = self;

    // Make up all table hashes and arrays

    consolelog("\nScanning initiated for ", self.table );

    self.nested.forEach( function( childNestedParams ){

      // The parameter childNestedParams.layer is a string. It needs to be
      // converted to a proper table, now that they are all instantiated.
      // The constructor will have a `registry` attribute, with the list of table
      // already instantiated
      var t = childNestedParams.layer.table;
      if( typeof( childNestedParams.layer ) === 'string' ){
        t = childNestedParams.layer;
        childNestedParams.layer = self.constructor.registry[ childNestedParams.layer ];
      }

      if( !childNestedParams.layer ){
        throw( new Error("Layer requested in nested parameter not found: " + t ) );
      }

      var childLayer = childNestedParams.layer;

      consolelog("\nScanning", parent.table, ", nested table:", childNestedParams.layer.table, ", nested params:", childNestedParams );
      consolelog("It has a parent. Setting info for", parent.table );

      if( childNestedParams.type == 'lookup' ){

        // Important check that localField is actually set
        if( typeof( childNestedParams.localField ) === 'undefined' ){
          throw( new Error( "localField needs to be set for type lookup" ) );
        }

        // Important check that layerField is actually set
        if( typeof( childNestedParams.layerField ) === 'undefined' ){
          throw( new Error( "layerField needs to be set for type lookup" ) );
        }

      }

      // Work out subName, depending on the type of the child.
      // - For multiple 1:n children, the subName can just be the child's table name
      // - For single lookups, since there can be more children lookups pointing to the same table,
      //   the key will need to be the localField name
      // This way, each record will have a list of children with a unique key, which will either
      // lead to a lookup or a multiple relationship.
      var subName;
      switch( childNestedParams.type ){
        case 'multiple': subName = childLayer.table; break;
        case 'lookup': subName = childNestedParams.localField; break;
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

      consolelog("Adding entries to father's _searchableHash to make sure that searchable children fields are searchable");
      
      // Making sure that all keys in join are marked as searchable in children (as well
      // as being in child's _searchableHash)
      if( childNestedParams.type === 'multiple'){
        Object.keys( childNestedParams.join ).forEach( function( key ){
          consolelog( "Forcing ", key, 'in table', childLayer.table, 'to be searchable' );
          childLayer._searchableHash[ key ] = childLayer.schema.structure[ key ];
          childLayer.schema.structure[ key ].searchable = true;
        });
      }
      var layerField = childNestedParams.layerField;
      consolelog( "Forcing ", layerField, 'in table', childLayer.table, 'to be searchable' );
      if( childNestedParams.type === 'lookup' ){
        childLayer._searchableHash[ layerField ] = childLayer.schema.structure[ layerField ];
        childLayer.schema.structure[ layerField ].searchable = true;
      }

      // Making sure that all searchable fields in child layer are searchable,
      // in the parent layer, as `parent.childField`
      Object.keys( childLayer.schema.structure ).forEach( function( fieldName ){

        var entry = childLayer.schema.structure[ fieldName ];
        consolelog( "Field:" , fieldName, ", Entry for that field: -- type: ", entry );
        consolelog( entry );

        // If entry is searchable, add the field to the _searchableHash
        if( entry.searchable ){
          consolelog("Field is searchable! So: ", subName + "." + fieldName, "will be searchable in father table" );

          self._searchableHash[ subName + "." + fieldName ] = entry;

          // Add the entry to indexGroup
          self._indexGroups[ subName ] = self._indexGroups[ subName ] || { indexes: {}, indexBase: childLayer.indexBase };
          if( entry.searchable ){

            // indexName and indexDirection can be changed by the schema definition
            var indexDirection = typeof( entry.indexDirection ) !== 'undefined' ? entry.indexDirection : 1;
            var indexName = typeof( entry.indexName ) !== 'undefined' ? entry.indexName : fieldName;
            var indexOptions = typeof( entry.indexOptions ) !== 'undefined' ? entry.indexOptions : {};

            var newEntry = { fields: {}, options: indexOptions };
            newEntry.fields[ fieldName ] = { entry: entry, direction: indexDirection };

            self._indexGroups[ subName].indexes[ indexName ] = newEntry;
          }
        }        
      }); 


      // Add the extra indexes as defined in extraIndexes 
      Object.keys( childLayer.extraIndexes ).forEach( function( indexName ) {
        var index = childLayer.extraIndexes[ indexName ];
        var indexOptions = index.options;

        // Work out the index's keys. This is the same as the passed "keys", but rather than
        // something line `{ workspaceId: 1 }`, it's `{ workspaceId: { direction: 1, entry: { type: 'id' } } }`
        var fields = {};
        Object.keys( index.fields ).forEach( function( fieldName ){

          var entry = childLayer.schema.structure[ fieldName ];

          var direction = index.fields[ fieldName ];
          fields[ fieldName ] = { entry: entry, direction: direction };
        });
        self._indexGroups[ subName ].indexes[ indexName ] = { extra: true, fields: fields, options: indexOptions };
      });


      
      consolelog("Making sure that join keys are searchable and in child's _searchableHash:" );

      // Makes sure that nested tables have ALL of the right indexes
      // so that joins always work
      //if( childNestedParams.type === 'lookup' ) var field = childNestedParams.localField;
      //else var field = childNestedParams.layer;

      
      consolelog("Parents searchable hash after cure:", parent._searchableHash );

      consolelog("Parents _indexGroups after cure:", parent._indexGroups );

    });
    consolelog("End of scanning");

  },

  // Utility function to make sure that ranges are sane and are
  // within the limits
  sanitizeRanges: function( ranges, skipLimit ){
    var self = this;

    // Prep work so that all checks are easy and straightforward
    if( typeof( ranges ) !== 'object' ) ranges = {};
    var hardLimit =  self.hardLimitOnQueries || Infinity; 

    // Set saneRanges up
    var saneRanges = {};
    saneRanges.skip = ranges.skip ? ranges.skip : 0;
    saneRanges.limit = ranges.limit ?
      ( ranges.limit > hardLimit && ! skipLimit ? hardLimit : ranges.limit ) :
                       hardLimit === Infinity ? 0 : hardLimit;

    // Return the sane range
    return saneRanges;
  },

  select: function( filters, options, cb ){

    // Usual drill
    if( typeof( cb ) === 'undefined' ){
      cb = options;
      options = {};
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
      options = {};
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
      options = {};
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
      options = {};
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


// **************************************************************************
//                        CLASS FUNCTIONS
// **************************************************************************
// All of these functions operate on the premise that they have a
// `registry` variable attached to the constructor itself. This registry is
// used by makeTableHashes() to look up a layer object from a table:
// 
//   if( typeof( childNestedParams.layer ) === 'string' ){
//      childNestedParams.layer = self.constructor.registry[ childNestedParams.layer ];
//    }
//
// So, it's absolutely crucial that db-specific mixins do their job properly, and
//
// 1) Add a registry to their constructing function: `MongoMixin.registry = {};`
// 2) Add each created instance to the registry by having this in their constructor:
//    constructor: function(){
//      // ...
//     `MongoMixin.registry[ self.table ] = self;`
//
// This all works on the premise that when using simpleDeclare(), the new constructor
// also inherits all class method from the parent.
// While the function themselves will be different, when accessing `this` from
// withing DbLayer.getLayer(), this.registry will be MongoMixin's (which is what
// we want).
//
// **************************************************************************


// Initialise all layers, creating relationship hashes
SimpleDbLayer.initLayers = function( ){

  var Layer = this;
  
  Object.keys( Layer.registry ).forEach( function( key ){
    var layer = Layer.registry[ key ];
    layer._makeTablesHashes();
  });
};
// Get layer from the class' registry
SimpleDbLayer.getLayer = function( tableName ){
  var Layer = this;

  if( typeof( Layer.registry ) === 'undefined' ) return undefined;
  return Layer.registry[ tableName ];
};

// Get all layers as a hash
SimpleDbLayer.getAllLayers = function(){
  var Layer = this;
  
  return Layer.registry;
};

SimpleDbLayer.generateSchemaIndexesAllLayers = function( options, cb ){

  var Layer = this;
  
  // This will contain the array of functions, one per layer
  var indexMakers = [];

  // Add one item to indexMakers for each table to reindex
  Object.keys( Layer.getAllLayers() ).forEach( function( table ){

    var layer = Layer.getLayer( table );
    
    indexMakers.push( function( cb ){
      layer.generateSchemaIndexes( options, cb );
    });

  });

  async.series( indexMakers, cb );
};

SimpleDbLayer.dropAllIndexesAllLayers = function( options, cb ){

  var Layer = this;
  
  // This will contain the array of functions, one per layer
  var indexMakers = [];

  // Add one item to indexMakers for each table to reindex
  Object.keys( Layer.getAllLayers() ).forEach( function( table ){

    var layer = Layer.getLayer( table );
    
    indexMakers.push( function( cb ){
      layer.dropAllIndexes( cb );
    });

  });

  async.series( indexMakers, cb );
};


exports = module.exports = SimpleDbLayer;

