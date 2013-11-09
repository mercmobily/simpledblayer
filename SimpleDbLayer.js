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
  fields: {},
  table: '',
  hardLimitOnQueries: 0,

  constructor: function( table,  fields, db ){

    var self = this;

    // Check parameters -- `table` and `fields` must be there
    if( typeof( fields ) === 'undefined' ){
      throw( new Error("SimpleDbLayer's constructor requires the 'fields' parameter in its constructor") );
    }
    if( typeof( table ) === 'undefined' ){
      throw( new Error("SimpleDbLayer's constructor requires the 'table' parameter in its constructor") );
    }

    // The `db` attribute can be passed to the constructor, or mixed in in advance
    if( typeof( db ) !== 'undefined' ){
      self.db = db;
    }

    // Check that the class has 'db' set (prototype, or coming from the constructor)
    if( typeof( self.db ) === 'undefined' ){
      throw( new Error("SimpleDbLayer's constructor need to have 'db' in their prototype") );
    }

    // Set the parameters
    self.fields = fields;
    self.table = table;
  },


  sanitizeRanges: function( ranges ){
    var saneRanges = {};
    if( ! this.hardLimitOnQueries ) var hardLimitOnQueries = 0;
  
    saneRanges.from = 0;
    saneRanges.to = 0;
    saneRanges.limit = 0;
 
    if( typeof( ranges ) === 'object' && ranges !== null ){

      // Copy values over to saneRanges
      saneRanges.from = ranges.from || 0;
      saneRanges.to = ranges.to || 0;
      saneRanges.limit = ranges.limit || 0;


      // Calculate `to` or `limit` (depending on which one is missing)

      // If `rangeFrom` and `rangeTo` are set, and limit isn't, then `limit`
      // will be set
      if( saneRanges.from != 0 && saneRanges.to != 0 && saneRanges.limit == 0 ){
        saneRanges.limit =  saneRanges.to - saneRanges.from + 1;
      // If `rangeFrom` and `limit` are set, and rangeTo isn't, then `to`
      // will be set
      } else if( saneRanges.from != 0 && saneRanges.limit != 0 && saneRanges.to == 0 ){
        saneRanges.to =  saneRanges.limit + saneRanges.from - 1;
      }

      // Sanity checks on limit (cannot go over 

      // If `limit` makes it go over `rangeTo`, then resize `limit`
      if(  saneRanges.limit != 0 && saneRanges.from + saneRanges.limit - 1 > saneRanges.to ){
        saneRanges.limit =  saneRanges.to - saneRanges.from + 1;
      }

      // Respect hard limit on number of returned records, limiting `limit` (if set) or
      // imposing it (if not set)
      if( hardLimitOnQueries !== 0 ){
        if( saneRanges.limit === 0 || saneRanges.limit > self.hardLimitOnQueries ){
          saneRanges.limit = hardLimitOnQueries;
        }
      }
    }

    return saneRanges;

  },

/*
  filters: { 
    type: 'and|or',
    fields: {
      name: {
        type: 'is',
        value: 'Tony'
      },
      surname: {
        type: 'startWith',
        value: 'Mob',
      },
      age: {
        type: 'lt|lte|gt|gte',
        value: 30,
      },
      tags: {
        type: 'contain',
        value: 'cool',
      },
      surname: {
        type: 'startWith',
        value: 'Mob',
      },
    },
    sort: [
      { name: -1 },
      { age: 1 }
    ]
  }
*/


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


});


exports = module.exports = SimpleDbLayer;


