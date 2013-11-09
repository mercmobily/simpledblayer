/*
Copyright (C) 2013 Tony Mobily

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var 
  dummy

, declare = require('simpledeclare')
, SimpleDbLayer = require('./SimpleDbLayer')
, MongoMixin = require('./MongoMixin.js')

, mw = require('mongowrapper')

;


mw.connect('mongodb://localhost/hotplate', {}, function( err, db ){

  // var DbLayer = declare( [ SimpleDbLayer, MongoMixin ], { db: db } );
  var DbLayer = declare( [ SimpleDbLayer, MongoMixin ], { db: db } );

  var people = new DbLayer( 'people', {  name: true, surname: true, age: true }, db );


  var searchFilter = { 

    ranges: {
      limit: 1
    },

    conditions: {

      and: {

        name: {
          type: 'startsWith',
          value: 'To'
        }
      },

      or: {

        age: {
          type: 'gt',
          value: 27,
        },
      },
    },

    sort: {
      name: -1,
      age: 1
    }

  };


  people.delete( {}, { multi: true } ,  function( err, howMany ){

    people.insert( { name: 'Tony', age: 37 }, { returnRecord: true }, function( err, person ){
      console.log("AFTER TONY:");
      console.log( err );
      console.log( person);
  
      people.insert( { name: 'Chiara', age: 24 }, { returnRecord: true }, function( err, person ){
        console.log("AFTER CHIARA");
        console.log( err );
        console.log( person);
        people.insert( { name: 'Sara', age: 14 }, { returnRecord: true }, function( err, person ){
          console.log("AFTER SARA");
          console.log( err );
          console.log( person);
          people.insert( { name: 'Delete 1', age: 11 }, { returnRecord: true }, function( err, record ){
            people.insert( { name: 'Delete 2', age: 12 }, { returnRecord: true }, function( err, record ){
              people.insert( { name: 'Delete 3', age: 13 }, { returnRecord: true }, function( err, record ){
 
/*
                people.select( {}, { useCursor: false , delete: true }, function( err, data ){
                  console.log("HERE:");
                  console.log( err );
                  console.log( data );
                  
                   
                });

                if( false ){
 */
                people.select( {}, { useCursor: true , delete: true }, function( err, cursor ){
  
                  console.log("USING CURSOR:");

                  cursor.next( function( err, p ){
                    console.log( p );
  
                    cursor.next( function( err, p ){
                      console.log( p );
  
                      cursor.next( function( err, p ){
                        console.log( p );
 
                        cursor.rewind( function( err, p ){
                          console.log("REWIND ERR:");
                          console.log( err );
 
                          cursor.next( function( err, p ){
                            console.log( p );
  
                            cursor.next( function( err, p ){
                              console.log( p );
                            });

                          });
  
                        });
                      });
  
                    });
                  });
  
                });

                //} // TEMP CONDITION
  
                /*
                people.update( { conditions: { and: { name: { type: 'startsWith', value: 'D' }  } } }, { name: 'Melete' }, { deleteUnsetFields: true, multi: true }, function( err, num ){
                  console.log("UPDATE DONE:");
                  console.log( err );
                  console.log( num );
  
                  people.delete( { conditions: { and: { name: { type: 'startsWith', value: 'EEE' }  } } }, { multi: true }, function( err, num ){
                    console.log("DELETE DONE:");
                    console.log( err );
                    console.log( num );
                  });
                });
                */
  
              });
            });
          });
        });
      });
    });
  });


});


