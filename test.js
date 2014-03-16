
/*
Copyright (C) 2013 Tony Mobily

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var 
  dummy

, declare = require('simpledeclare')
, SimpleSchema = require('simpleschema')
, SimpleDbLayer = require('./SimpleDbLayer.js')
, async = require('async')
;


var db, layer;

var peopleData = exports.peopleData = [
  { name: 'Chiara',    surname: 'Mobily',     age: 22 },
  { name: 'Tony',      surname: 'Mobily',     age: 37 },
  { name: 'Sara',      surname: 'Connor',     age: 14 },
  { name: 'Daniela',   surname: 'Mobily',     age: 64 },
];

function i( v ){
  console.log( require( 'util' ).inspect( v, { depth: 10 } ) );
}

var compareItems = function( test, a, b ){

  var a1 = {}, b1 = {};

  for( var k in a ) a1[ k ] = a[ k ];
  for( var k in b ) b1[ k ] = b[ k ];

  if( a1._children ) delete a1._children;
  if( b1._children ) delete b1._children;

  return compareCollections( test, [ a1 ], [ b1 ] );
}

var compareCollections = function( test, a, b ){

  // Makes sure that records have the keys in the right order
  var a0 = [];
  for( var i = 0, l = a.length; i < l; i ++ ){
    var item = a[ i ];
    var newItem = {};
    Object.keys( item ).sort().forEach( function( k ){
      newItem[ k ] = item[ k ];
    });
    delete newItem._children;
    a0.push( newItem );
  }
  var b0 = [];
  for( var i = 0, l = b.length; i < l; i ++ ){
    var item = b[ i ];
    var newItem = {};
    Object.keys( item ).sort().forEach( function( k ){
      newItem[ k ] = item[ k ];
    });
    delete newItem._children;
    b0.push( newItem );
  }

  try {
    var a1 = [], a2, a3;
    a0.forEach( function( item ){
      a1.push( JSON.stringify( item ) );
    });
    a2 = a1.sort();
    a3 = JSON.stringify( a2 );

    var b1 = [], b2, b3;
    b0.forEach( function( item ){
      b1.push( JSON.stringify( item ) );
    });
    b2 = b1.sort();
    b3 = JSON.stringify( b2 );
  } catch ( e ){
    test.fail( a, b, "Comparison failed", "recordset comparison" );
  }

  equal = ( a3 == b3 );

  if( ! equal ){
    test.fail( a, b, "Record sets do not match", "recordset comparison" );
    //test.fail( a, b, console.log("MISMATCH BETWEEN:" );
    //console.log( a );
    //console.log( b );
    //console.log( a3 );
    //console.log( b3 );

    console.log( (new Error()).stack );
  }

  //test.ok( equal, "Record sets do not match" );
 
}

var populateCollection = function( data, collection, cb ){

  var functions = [];

  // Populate the database
  data.forEach( function( datum ){

    functions.push( function( done ){
      collection.insert( datum, function( err ){
        if( err ){
          cb( err );
        } else{
          done( null );
        }
      })
    })

  })

  async.series( functions, function( err, res ){
    if( err ){
      cb( err );
    } else {
      cb( null );
    }
  });
}


var clearAndPopulateTestCollection = function( g, cb ){
  
  g.people.delete( { }, { multi: true }, function( err ){
   if( err ){
      cb( err );
    } else {

      populateCollection( peopleData, g.people, function( err ){
        if( err ){
          cb( err );
        } else {

          cb( null );

        }
      })
    }
  })
}

exports.get = function( getDbInfo, closeDb, makeExtraTests ){
  
  var tests;
  var g = {};

  var startup = function( test ){
    var self = this;


    process.on('uncaughtException', function(err) {
      console.error(err.stack);
    });


    getDbInfo( function( err, db, SchemaMixin, DriverMixin ){
      if( err ){
        throw( new Error("Could not connect to db, aborting all tests") );
        process.exit();
      }

      // Set the important g.driver variables (db and DriverMixin)
      g.driver = {};
      g.driver.db = db;
      g.driver.DriverMixin = DriverMixin;
      g.driver.SchemaMixin = SchemaMixin;

     
      g.commonPeopleSchema = new SchemaMixin( {
        name   : { type: 'string', searchable: true, sortable: true },
        surname: { type: 'string', searchable: true, sortable: true },
        age    : { type: 'number', searchable: true, sortable: true, required: true },
      });

      test.done();
    });
  }


  var finish = function( test ){
    var self = this;
    closeDb( g.driver.db, function( err ){
      if( err ){
        throw( new Error("There was a problem disconnecting to the DB") );
      }
      test.done();
    });
  };


  tests = {

    startup: startup,


    "create constructors and layers": function( test ){
      var self = this;

      try { 
        g.Layer = declare( [ SimpleDbLayer, g.driver.DriverMixin ], { db: g.driver.db });

        g.people = new g.Layer( 'people', { schema: g.commonPeopleSchema, idProperty: 'name' } );
		  	test.ok( g.people );

      } catch( e ){
        console.log("Error: couldn't create basic test layers, aborting all tests...");
        console.log( e );
        console.log( e.stack );
        process.exit();
      }


      // Test that it works also by passing the db in the constructor
      var LayerNoDb = declare( [ SimpleDbLayer, g.driver.DriverMixin ] );
      var peopleDb = new LayerNoDb( 'people', { schema: g.commonPeopleSchema, idProperty: 'name' } , g.driver.db );
      test.ok( peopleDb );
      test.ok( peopleDb.db === g.people.db );


      // Test that passing `db` will override whatever was in the prototype
      var fakeDb = { collection: function(){ return "some" } };
      var peopleRewriteDb = new g.Layer( 'people', { schema: g.commonPeopleSchema, idProperty: 'name' }, fakeDb );
      test.ok( fakeDb === peopleRewriteDb.db );

      // Test that not passing `db` anywhere throws
      test.throws( function(){        
        new LayerNoDb( 'people', { schema: g.commonPeopleSchema, idProperty: 'name' } );
      }, undefined, "Constructing a collection without definind DB in prototype or constructions should fail");

      test.done();

    },

    "insert with returnRecord": function( test ){

      g.people.delete( { }, { multi: true }, function( err ){
        test.ifError( err );
        var person = { name: "Joe", surname: "Mitchell", age: 48 };
        g.people.insert( person, { returnRecord: true }, function( err, personReturned ){
          test.ifError( err );
          test.deepEqual( person, personReturned, "Mismatch between what was written onto the DB and what returned from the DB" );

          test.done();
        });
      });

    },

    "insert without returnRecord": function( test ){

      g.people.delete( { }, { multi: true }, function( err ){
        test.ifError( err );

        var person = { name: "Joanna", surname: "Mitchell", age: 45 };
        g.people.insert( person, { returnRecord: false }, function( err, personReturned ){
          test.ifError( err );
          test.equal( undefined, personReturned, "If returnRecord is false, the second callback parameter must be undefined" );
          test.done();
        });
      });
    },
      
      //   g.people.select( { ranges: { limit: 1  }, conditions: { and: { name: { type: 'is', value: 'Joe' }, surname: { type: 'is', value: 'Mitchell' }, age:  { type: 'is', value: 48 } } } }

    "selects, equality" : function( test ){

      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );
          g.people.select( { conditions: { and: [ { field: 'name', type: 'is', value: 'Tony' }, { field: 'surname', type: 'is', value: 'Mobily' }, { field: 'age', type: 'is', value: 37 } ] } }, function( err, results, total ){ 

          test.ifError( err );

          var r = [ { name: 'Tony',      surname: 'Mobily',  age: 37 } ];

          test.equal( total, 1 );
          compareCollections( test, results, r );
          
          test.done();
        })


      })
    },

    "selects, partial equality": function( test ){

        var self = this;

      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );


        g.people.select( { conditions: { and: [ { field: 'surname', type: 'startsWith', value: 'Mob' } ] } }, function( err, results, total ){
          test.ifError( err );

          //console.log("ERROR HAPPENING NOW!");
          //p.e.r=10;
          //console.log("ERROR HAPPENED!");

          var r = [
                    { name: 'Tony',      surname: 'Mobily',     age: 37 },
                    { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                    { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                  ];

          test.equal( total, 3 );
          compareCollections( test, results, r );

          g.people.select( { conditions: { and: [ { field: 'surname', type: 'endsWith', value: 'nor' } ]  } }, function( err, results, total ){
            test.ifError( err );

            var r = [
              { name: 'Sara',  surname: 'Connor', age: 14 },
            ];

            compareCollections( test, results, r );
            test.equal( total, 1 );

            g.people.select( { conditions: { and: [ { field: 'surname', type: 'contains', value: 'on' } ] } }, function( err, results, total ){
              test.ifError( err );

              var r = [
                { name: 'Sara',  surname: 'Connor', age: 14 },
              ];

              compareCollections( test, results, r );
              test.equal( total, 1 );

              test.done();
            });
          });
        })
        
      })
    },

    "selects, comparisons": function( test ){

      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        g.people.select( { conditions: { and: [ { field: 'name', type: 'gt', value: 'M' } ] } }, function( err, results, total ){
          test.ifError( err );

          var r = [
            { name: 'Tony',      surname: 'Mobily',     age: 37 },
            { name: 'Sara',      surname: 'Connor',     age: 14 },
          ];

          compareCollections( test, results, r );
          test.equal( total, 2 );

          g.people.select( { conditions: { and: [ { field: 'age', type: 'gt', value: 22 } ] } }, function( err, results, total ){
            test.ifError( err );

            var r = [
              { name: 'Tony',      surname: 'Mobily',     age: 37 },
              { name: 'Daniela',   surname: 'Mobily',     age: 64 },
            ];

            compareCollections( test, results, r );
            test.equal( total, 2 );


            g.people.select( { conditions: { and: [ { field: 'age', type: 'gte', value: 22 } ] } }, function( err, results, total ){
              test.ifError( err );

              var r = [
                { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                { name: 'Tony',      surname: 'Mobily',     age: 37 },
                { name: 'Daniela',   surname: 'Mobily',     age: 64 },
              ];

              compareCollections( test, results, r );
              test.equal( total, 3 );


              g.people.select( { conditions: { and: [ { field: 'age', type: 'gt', value: 22 }, { field: 'age', type: 'lt', value: 60 }] } }, function( err, results, total ){
                test.ifError( err );

                var r = [
                 { name: 'Tony',      surname: 'Mobily',     age: 37 },
                ];

                compareCollections( test, results, r );
                test.equal( total, 1 );

                test.done();
              })
            })
          })

        });
        
      })
    },


    "selects, ranges and limits": function( test ){
     
       clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );
        g.people.select( { ranges: { limit: 1 } }, function( err, results, total, grandTotal ){
          test.ifError( err );

          test.equal( total, 1 );
          test.equal( grandTotal, 4 );

          g.people.select( { ranges: { limit: 2 } }, function( err, results, total ){
            test.ifError( err );

            test.equal( total, 2 );
            test.equal( grandTotal, 4 );

            g.people.select( { ranges: { from: 1, to: 3 } }, function( err, results, total ){
              test.ifError( err );

              test.equal( total, 3 );
              test.equal( grandTotal, 4 );

              g.people.select( { ranges: {  to: 2 } }, function( err, results, total ){
                test.ifError( err );

                test.equal( total, 3 );
                test.equal( grandTotal, 4 );

                g.people.select( { ranges: { from: 1 } }, function( err, results, total ){
                  test.ifError( err );

                  test.equal( total, 3 );;
                  test.equal( grandTotal, 4 );

                  g.people.select( { ranges: { to: 4, limit: 2 } }, function( err, results, total ){
                    test.ifError( err );

                    test.equal( total, 2 );
                    test.equal( grandTotal, 4 );

                    g.people.select( { ranges: { from: 1, to: 4, limit: 2 } }, function( err, results, total ){
                      test.ifError( err );

                      test.equal( total, 2 );
                      test.equal( grandTotal, 4 );
                      test.done();
                    });
                  });

                });

              });

            })
          })

        });
        
      })
    
    },

    "selects, sort": function( test ){

      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        g.people.select( { sort: { name: 1 } }, function( err, results, total ){
          test.ifError( err );

          var r =  [
            { name: 'Chiara',    surname: 'Mobily',     age: 22 },
            { name: 'Daniela',   surname: 'Mobily',     age: 64 },
            { name: 'Sara',      surname: 'Connor',     age: 14 },
            { name: 'Tony',      surname: 'Mobily',     age: 37 },
          ];

          test.deepEqual( results, r );
          test.equal( total, 4 );


          g.people.select( { sort: { surname: 1, name: 1 } }, function( err, results, total ){
            test.ifError( err );

            var r =  [
              { name: 'Sara',      surname: 'Connor',     age: 14 },
              { name: 'Chiara',    surname: 'Mobily',     age: 22 },
              { name: 'Daniela',   surname: 'Mobily',     age: 64 },
              { name: 'Tony',      surname: 'Mobily',     age: 37 },
            ];

            test.deepEqual( results, r );
            test.equal( total, 4 );

            g.people.select( { ranges: { limit: 2 },  sort: { surname: -1, age: -1 } }, function( err, results, total ){
              test.ifError( err );

              var r =  [
                { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                { name: 'Tony',      surname: 'Mobily',     age: 37 },
              ];

              test.deepEqual( results, r );
              test.equal( total, 2 );

              test.done();
            });

          });

        });
      })

    },

    "selects, cursor": function( test ){

      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        g.people.select( { sort: { name: 1 } }, { useCursor: true }, function( err, cursor, total ){
          test.ifError( err );
 
          console.log("ERR IS:", err );
 
          test.notEqual( cursor, null );
          test.notEqual( cursor, undefined );
          console.log("CURSOR IS:", cursor );
          test.equal( total, 4 );
          
          var r =  [
            { name: 'Chiara',    surname: 'Mobily',     age: 22 },
            { name: 'Daniela',   surname: 'Mobily',     age: 64 },
            { name: 'Sara',      surname: 'Connor',     age: 14 },
            { name: 'Tony',      surname: 'Mobily',     age: 37 },
          ];
          cursor.next( function( err, person ){
            test.ifError( err );
            test.deepEqual( person, r[ 0 ] );
  
            cursor.next( function( err, person ){
              test.ifError( err );
              test.deepEqual( person, r[ 1 ] );
  
              cursor.next( function( err, person ){
                test.ifError( err );
                test.deepEqual( person, r[ 2 ] );
  
                cursor.next( function( err, person ){
                  test.ifError( err );
                  test.deepEqual( person, r[ 3 ] );
  
                  cursor.next( function( err, person ){
                    test.ifError( err );
                    test.deepEqual( person, null );
  
                    test.done();
                  });
                });
              });
            });
          });
        });
      })
    },




    "deletes": function( test ){
    
      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        g.people.select( { },  function( err, results, total ){
          test.ifError( err );
  
          var r =  [
            { name: 'Chiara',    surname: 'Mobily',     age: 22 },
            { name: 'Tony',      surname: 'Mobily',     age: 37 },
            { name: 'Sara',      surname: 'Connor',     age: 14 },
            { name: 'Daniela',   surname: 'Mobily',     age: 64 },
          ];

          compareCollections( test, results, r );
          test.equal( total, 4 );

          
          g.people.delete( { conditions: { and: [ { field: 'name', type: 'is', value: 'DOES NOT EXIST' } ] }  },  function( err, howMany ){
            test.ifError( err );
 
            test.equal( howMany, 0 );

            g.people.delete( { conditions: { and: [ { field: 'name', type: 'is', value: 'Tony' } ] }  },  function( err, howMany ){
              test.ifError( err );
   
              test.equal( howMany, 1 );
  
              g.people.select( { },  function( err, results, total ){
                test.ifError( err );
    
                var r =  [
                  { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                  { name: 'Sara',      surname: 'Connor',     age: 14 },
                  { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                ];

                compareCollections( test, results, r );
                test.equal( total, 3 );

  
                g.people.delete( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ] }  }, { multi: true }, function( err, howMany){
                  test.ifError( err );
    
                  test.equal( howMany, 2 );
  
                  g.people.select( { },  function( err, results, total ){
                    test.ifError( err );
    
                    var r =  [
                      { name: 'Sara',      surname: 'Connor',     age: 14 },
                    ];

                    compareCollections( test, results, r );
                    test.equal( total, 1 );
  
                    clearAndPopulateTestCollection( g, function( err ){
                      test.ifError( err );
  
                      g.people.delete( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ] }, sort: { name: -1 }   }, function( err, howMany ){
                        test.ifError( err );
    
                        test.deepEqual( howMany, 1 );
  
                        g.people.select( { },  function( err, results, total ){
                          test.ifError( err );
   
                          var r =  [
                            { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                            //{ name: 'Tony',      surname: 'Mobily',     age: 37 },
                            { name: 'Sara',      surname: 'Connor',     age: 14 },
                            { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                          ];

                          compareCollections( test, results, r );
                          test.equal( total, 3 );
   
                          test.done();
                        });
                      });
                    })
                  })
                });
              })
            })
          });
        }); 
      })
    },


    "select, or filters": function( test ){
      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );


        g.people.select( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ], or: [ { field: 'age', type: 'is', value: 37 }, { field: 'age', type: 'is', value: 22 }  ]  } }, function( err, results, total ){
          test.ifError( err );

          var r = [
                    { name: 'Tony',      surname: 'Mobily',     age: 37 },
                    { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                  ];

          test.equal( total, 2 );
          compareCollections( test, results, r );

          test.done();
        });
      });
    },

    "select, hardLimitOnQuery and grandTotal": function( test ){
      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        var people2 = new g.Layer( 'people', { schema: g.commonPeopleSchema, idProperty: 'name' } );
        people2.hardLimitOnQueries = 2;

        people2.select( { sort: { age: 1 } }, function( err, results, total, grandTotal ){
          test.ifError( err );

          var r = 

[ { name: 'Sara', surname: 'Connor', age: 14 },
  { name: 'Chiara', surname: 'Mobily', age: 22 } ]

          ;

          test.equal( total, 2 );
          compareCollections( test, results, r );

          test.done();
        });
      });
    },


    "select, case insensitive": function( test ){
      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );


        g.people.select( { conditions: { and: [ { field: 'surname', type: 'is', value: 'MObILy' } ] } }, function( err, results, total ){
          test.ifError( err );

          var r = [
                    { name: 'Tony',      surname: 'Mobily',     age: 37 },
                    { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                    { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                  ];


          test.equal( total, 3 );
          compareCollections( test, results, r );

          g.people.select( { conditions: { and: [ { field: 'surname', type: 'contains', value: 'ObI' } ] } }, function( err, results, total ){
            test.ifError( err );

            test.equal( total, 3 );
            compareCollections( test, results, r );

            test.done();
          });
        });
      });
    },




    "updates": function( test ){
      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        g.people.update( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ] } }, { surname: 'Tobily' }, { multi: true }, function( err, howMany ){
          test.ifError( err );

          test.deepEqual( howMany, 3 );

          g.people.select( { },  function( err, results, total ){
            var r =  [
              { name: 'Chiara',    surname: 'Tobily',     age: 22 },
              { name: 'Tony',      surname: 'Tobily',     age: 37 },
              { name: 'Sara',      surname: 'Connor',     age: 14 },
              { name: 'Daniela',   surname: 'Tobily',     age: 64 },
            ];

            compareCollections( test, results, r );
            test.equal( total, 4 );

            g.people.update( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Tobily' } ] }, sort: { name: -1 }  }, { surname: 'Lobily' }, function( err, howMany ){
              test.deepEqual( howMany, 1 );

              g.people.select( { },  function( err, results, total ){
                var r =  [
                  { name: 'Chiara',    surname: 'Tobily',     age: 22 },
                  { name: 'Tony',      surname: 'Lobily',     age: 37 },
                  { name: 'Sara',      surname: 'Connor',     age: 14 },
                  { name: 'Daniela',   surname: 'Tobily',     age: 64 },
                ];

                compareCollections( test, results, r );
                test.equal( total, 4 );


                g.people.update( { conditions: { and: [ { field: 'name', type: 'is', value: 'Tony' } ] } }, { name: 'Tony', age: 38 }, { deleteUnsetFields: true }, function( err, howMany ){

                  test.equal( howMany, 1 );

                  g.people.select( { conditions: { and: [ { field: 'name', type: 'is', value: 'Tony' } ] } },  function( err, results, total ){

                    test.equal( total, 1 );

                    compareItems( test, results[ 0 ], { age: 38, name: "Tony" } );

                    test.done();
                  })
                });
              })


            });
          })
        });
      })
    },

    /*
    "updates do not unset required fields": function( test ){
      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        test.throws(
          function(){
            g.people.update( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ] } }, { surname: 'Tobily' }, { multi: true, deleteUnsetFields: true }, function( err, howMany ){
              if( err ) throw( err );
            });
          },
          Error,
          "should throw as passed 'deleteUnsetFields: true' and didn't pass all required fields"
        );
      })
    },
    */

    "refs": function( test ){
      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        var peopleR = new g.Layer( 'peopleR', {
          schema: new g.driver.SchemaMixin( {
            id      : { type: 'id', required: true, searchable: true, permutePrefix: true },
            name    : { type: 'string', searchable: true, sortable: true, permute: true },
            surname : { type: 'string', searchable: true, sortable: true, permute: true },
            age     : { type: 'number', searchable: true, sortable: true, permute: true },

            configId: { type: 'id', required: true } ,
            motherId: { type: 'id', required: false, searchable: true },
          }),
          idProperty: 'id',
          positionField: 'position',
          positionBase: [ ],
          nested: [
            {
              layer: 'addressesR',
              join: { personId: 'id' },
              type: 'multiple',
              autoLoad: true,
              searchable: true,
            },

            { 
              layer: 'configR',
              join: { 'id': 'configId' }, 
              parentField: 'configId',
              type: 'lookup',
              autoLoad: true,
              searchable: true,
            },

            { 
              layer: 'peopleR',
              join: { 'id': 'motherId' }, 
              parentField: 'motherId',
              type: 'lookup',
              autoLoad: true,
              searchable: true,
            },

          ]
        });
 
        var addressesR = new g.Layer( 'addressesR', {
          schema: 
            new g.driver.SchemaMixin( {
              id       : { type: 'id', required: true, searchable: true },
              personId : { type: 'id', required: true, searchable: true, permutePrefix: true },
              street   : { type: 'string', searchable: true, permute: true },
              city     : { type: 'string', searchable: true, permute: true },
              configId : { type: 'id', required: false },
            }),
          idProperty: 'id',
          positionField: 'position',
          positionBase: [ 'personId' ],
          nested: [
            { 
              layer: 'configR',
              type: 'lookup',
              parentField: 'configId',
              join: { id: 'configId' }, 
              autoLoad: true,
              searchable: true,
            },

           { 
              layer: 'peopleR',
              type: 'lookup',
              parentField: 'personId',
              join: { id: 'personId' }, 
              autoLoad: true,
            },

          ]
        });

        var configR = new g.Layer( 'configR', {
          schema: new g.driver.SchemaMixin( {
            id       : { type: 'id', required: true, searchable: true },
            configField  : { type: 'string', searchable: true, sortable: true, permute: true },
            configValue  : { type: 'string', searchable: true, sortable: true, permute: true },
          }),
          idProperty: 'id',
        });

        // Zap DB and make up records ready to be added

        /*
          TO TEST:

          INSERTING
          ---------
          [ V ] Insert normal record (configR)
          [ V ] Insert normal record with lookup relationship (peopleR pointing to configR)
          [ V ] Insert record with 1:n relationship (addressesR child of a peopleR)
          [ V ] Insert record with 1:n relationship and a lookup (addressesR child of a peopleR and with a configId)
                    
          UPDATING/DELETING
          -----------------

          [ V ] Update (single) configR: do _all_ fathers get updated/deleted?
          [ V ] Update (mass) configR: do _all_ fathers get updated/deleted?

          [   ] Update (single) addressesR: does the father get updated/deleted?
          [   ] Update (mass) addressesR: does the father get updated/deleted?

          SELECT
          ------
          [   ] Select filtering by subrecord


        */
       
        function prepareGround( cb ){

          async.eachSeries(
            [ peopleR, addressesR, configR ],
            function( item, cb){
              item.delete( { }, { multi: true }, cb );
            },
            function( err ){
              if( err ) return cb( err );
              cb( null );
            }
          );
        };

        var data = {};

        prepareGround( function(){

          console.log("INITIALISING LAYERS..." );
          SimpleDbLayer.initLayers();
 
          // Insert normal record (configR)

          function insertFirstConfigRecord( cb ){

            console.log("Running insertFirstConfigRecord...");

            data.c1 = {
              configField: 'C1 - Config Field',
              configValue: 'C1 - Config Value'
            };
            g.driver.SchemaMixin.makeId( data.c1, function( err, id ) {
              test.ifError( err );
              data.c1.id = id;

              configR.insert( data.c1, function( err ){
                if( err ) return cb( err );

                configR.select( { },  function( err, results, total ){
                  test.ifError( err );
    
                  test.equal( total, 1 );
                  compareCollections( test, [ data.c1 ], results );

                  cb( null );
                });
              });
            });
          }; 

          function insertSecondConfigRecord( cb ){

            console.log("Running insertSecondConfigRecord...");

            data.c2 = {
              configField: 'C2 - Config Field',
              configValue: 'C2 - Config Value'
            };
            g.driver.SchemaMixin.makeId( data.c2, function( err, id ) {
              test.ifError( err );
              data.c2.id = id;

              configR.insert( data.c2, function( err ){
                if( err ) return cb( err );

                configR.select( { },  function( err, results, total ){
                  test.ifError( err );
    
                  test.equal( total, 2 );
                  compareCollections( test, [ data.c1, data.c2 ], results );

                  cb( null );
                });
              });
            });
          }; 

 

          function insertFirstPerson( cb ){

            console.log("Running insertFirstPerson...");

            data.p1 = {
              name   : 'Tony',
              surname: 'Mobily',
              age: 38,
              configId: data.c1.id
            };
            g.driver.SchemaMixin.makeId( data.p2, function( err, id ) {
              test.ifError( err );

              data.p1.id = id;

              peopleR.insert( data.p1, function( err ){
                if( err ) return cb( err );

                peopleR.select( { },  { children: true }, function( err, results, total ){
                  test.ifError( err );
   
                  // Only one result came back
                  test.equal( total, 1 );

                  var singleResult = results[ 0 ];

                  // Check that configId and addressesR are there and are correct
                  compareItems( test, singleResult._children.configId, data.c1 );
                  test.deepEqual( singleResult._children.addressesR, [] );
                  
                  // Check that results EXCLUDING children are correct
                  delete singleResult._children;  
                  compareItems( test, results[ 0 ], data.p1 );

                  cb( null );
                });
              });
            });
          }; 

          function insertFirstAddress( cb ){

            console.log("Running insertFirstAddress...");

            data.a1 = {
              personId: data.p1.id,
              street  : 'bitton',
              city    : 'perth',
              configId: data.c1.id
            };
            g.driver.SchemaMixin.makeId( data.a1, function( err, id ) {
              test.ifError( err );
              data.a1.id = id;


              addressesR.insert( data.a1, function( err ){
                if( err ) return cb( err );

                addressesR.select( { },  { children: true }, function( err, results, total ){
                  test.ifError( err );
   
                  // Only one result came back
                  test.equal( total, 1 );

                  var singleResult = results[ 0 ];

                  // Check that configId and addressesR are there and are correct
                  compareItems( test, singleResult._children.configId, data.c1 );
                  compareItems( test, singleResult._children.personId, data.p1 );
                  
                  // Check that results EXCLUDING children are correct
                  delete singleResult._children;  
                  compareItems( test, singleResult, data.a1 );


                  // CHECKING PEOPLE (the address must be added as a child record)
                  peopleR.select( { },  { children: true }, function( err, results, total ){
                    test.ifError( err );
   
                    // Only one result came back
                    test.equal( total, 1 );

                    var singleResult = results[ 0 ];

                    // Check that configId and addressesR are there and are correct
                    compareItems( test, singleResult._children.configId, data.c1 );
                    compareCollections( test, singleResult._children.addressesR, [ data.a1 ] );

                    // Check that results EXCLUDING children are correct
                    delete singleResult._children;
                    compareItems( test, singleResult, data.p1 );

                    cb( null );
                  });
                });
              });
            });
          }; 

          function insertSecondAddress( cb ){

            data.a2 = {
              personId: data.p1.id,
              street  : 'samson',
              city    : 'perth',
            };
            g.driver.SchemaMixin.makeId( data.a2, function( err, id ) {
              test.ifError( err );
              data.a2.id = id;


              addressesR.insert( data.a2, function( err ){
                if( err ) return cb( err );

                addressesR.select( { },  { children: true }, function( err, results, total ){
                  test.ifError( err );
   
                  // Only one result came back
                  test.equal( total, 2 );

                  // Check that personId is correct in both cases
                  compareItems( test, results[ 0 ]._children.personId, data.p1 );
                  compareItems( test, results[ 1 ]._children.personId, data.p1 );
                  
                  // Check that results EXCLUDING children are correct
                  delete results[ 0 ]._children;  
                  delete results[ 1 ]._children;  
                  compareCollections( test, [ data.a1, data.a2 ], results );

                  // CHECKING PEOPLE (the address must be added as a child record)
                  peopleR.select( { },  { children: true }, function( err, results, total ){
                    test.ifError( err );
   
                    // Only one result came back
                    test.equal( total, 1 );

                    var singleResult = results[ 0 ];

                    // Check that configId and addressesR are there and are correct
                    compareItems( test, singleResult._children.configId, data.c1 );
                    compareCollections( test, singleResult._children.addressesR, [ data.a1, data.a2 ] );

                    // Check that results EXCLUDING children are correct
                    delete singleResult._children;
                    compareItems( test, singleResult, data.p1 );

                    cb( null );
                  });
                });
              });
            });
          }


          function insertSecondPerson( cb ){

            console.log("Running insertSecondPerson...");

            data.p2 = {
              name   : 'Chiara',
              surname: 'Mobily',
              age: 24,
              configId: data.c2.id
            };
            g.driver.SchemaMixin.makeId( data.p2, function( err, id ) {
              test.ifError( err );

              data.p2.id = id;

              peopleR.insert( data.p2, function( err ){
                if( err ) return cb( err );

                peopleR.select( { conditions: { and: [ { field: 'name', type: 'is', value: 'Chiara'  }   ]  }  },  { children: true }, function( err, results, total ){
                  test.ifError( err );
   
                  // Only one result came back
                  test.equal( total, 1 );

                  var singleResult = results[ 0 ];

                  // Check that configId and addressesR are there and are correct
                  compareItems( test, singleResult._children.configId, data.c2 );
                  test.deepEqual( singleResult._children.addressesR, [] );
                  
                  // Check that results EXCLUDING children are correct
                  delete singleResult._children;  
                  compareItems( test, results[ 0 ], data.p2 );

                  cb( null );
                });
              });
            });
          }; 


          function insertThirdPerson( cb ){

            console.log("Running insertThirdPerson...");

            data.p3 = {
              name   : 'Sara',
              surname: 'Fabbietti',
              age: 14,
              configId: data.c2.id
            };
            g.driver.SchemaMixin.makeId( data.p3, function( err, id ) {
              test.ifError( err );

              data.p3.id = id;

              peopleR.insert( data.p3, function( err ){
                if( err ) return cb( err );

                peopleR.select( { conditions: { and: [ { field: 'name', type: 'is', value: 'Sara'  }   ]  }  },  { children: true }, function( err, results, total ){
                  test.ifError( err );
   
                  // Only one result came back
                  test.equal( total, 1 );

                  var singleResult = results[ 0 ];

                  // Check that configId and addressesR are there and are correct
                  compareItems( test, singleResult._children.configId, data.c2 );
                  test.deepEqual( singleResult._children.addressesR, [] );
                  
                  // Check that results EXCLUDING children are correct
                  delete singleResult._children;  
                  compareItems( test, results[ 0 ], data.p3 );

                  cb( null );
                });
              });
            });
          }; 

          function insertThirdAddress( cb ){

            console.log("Running insertThirdAddress...");

            data.a3 = {
              personId: data.p2.id,
              street  : 'ivermey',
              city    : 'perth',
              configId: data.c2.id
            };
            g.driver.SchemaMixin.makeId( data.a3, function( err, id ) {
              test.ifError( err );
              data.a3.id = id;


              addressesR.insert( data.a3, function( err ){
                if( err ) return cb( err );

                addressesR.select( { conditions: { and: [ { field: 'street', type: 'is', value: 'ivermey' }  ]   }  },  { children: true }, function( err, results, total ){
                  test.ifError( err );
   
                  // Only one result came back
                  test.equal( total, 1 );

                  var singleResult = results[ 0 ];

                  // Check that configId and addressesR are there and are correct
                  compareItems( test, singleResult._children.configId, data.c2 );
                  compareItems( test, singleResult._children.personId, data.p2 );
                  
                  // Check that results EXCLUDING children are correct
                  delete singleResult._children;  
                  compareItems( test, singleResult, data.a3 );


                  // CHECKING PEOPLE (the address must be added as a child record)
                  peopleR.select( { conditions: { and: [ { field: 'name', type: 'is', value: 'Chiara'  }   ]  } },  { children: true }, function( err, results, total ){
                    test.ifError( err );
   
                    // Only one result came back
                    test.equal( total, 1 );

                    var singleResult = results[ 0 ];

                    // Check that configId and addressesR are there and are correct
                    compareItems( test, singleResult._children.configId, data.c2 );
                    compareCollections( test, singleResult._children.addressesR, [ data.a3 ] );

                    // Check that results EXCLUDING children are correct
                    delete singleResult._children;
                    //compareItems( test, singleResult, data.p3 );
                    //compareItems( test, singleResult, data.a3 );

                    cb( null );
                  });
                });
              });
            });
          }; 

          function updateSingleConfig( cb ){

            console.log("Running updateSingleConfig...");

            configR.update( { conditions: { and: [ { field: 'id', type: 'is', value: data.c2.id } ]  } }, { configField: 'C2 - Config Field CHANGED', configValue: 'C2 - Config Value CHANGED' }, { multi: false }, function( err ){

              test.ifError( err );

              data.c2 = {
                id: data.c2.id,
                configField: 'C2 - Config Field CHANGED',
                configValue: 'C2 - Config Value CHANGED'
              }


              peopleR.select( {}, { children: true }, function( err, results ){

                results.forEach( function( person ){

                  switch( person.name ){
                    case 'Tony':
                      compareItems( test, person._children.configId, data.c1 );
                    break;

                    case 'Chiara':
                      compareItems( test, person._children.configId, data.c2 );
                    break;

                    case 'Sara':
                      compareItems( test, person._children.configId, data.c2 );
                    break;

                    default:
                     test.ok( false, "Name not recognised?" ); 
                    break;                    
                  }
                });

                addressesR.select( {}, { children: true }, function( err, results ){

                  results.forEach( function( address ){

                    switch( address.street ){
                      case 'bitton':
                        compareItems( test, address._children.configId, data.c1 );
                      break;

                      case 'ivermey':
                        compareItems( test, address._children.configId, data.c2 );
                      break;

                      case 'samson':
                        test.ok( typeof( address._children.configId ) === 'undefined', "_children.configId should be undefined as configId is undefined" );
                      break;

                      default:
                       test.ok( false, "Street not recognised?" ); 
                      break;                    
                    }
                  });

                  return cb( null );;

                });
              });

            });
          };

          function updateMultipleConfig( cb ){

            console.log("Running updateMultipleConfig...");

            configR.update( { conditions: { and: [ { field: 'configField', type: 'is', value: "C2 - Config Field CHANGED" } ]  } }, { configField: 'C2 - Config Field CHANGED AGAIN', configValue: 'C2 - Config Value CHANGED AGAIN' }, { multi: true }, function( err ){

              test.ifError( err );

              data.c2 = {
                id: data.c2.id,
                configField: 'C2 - Config Field CHANGED AGAIN',
                configValue: 'C2 - Config Value CHANGED AGAIN'
              }

              peopleR.select( {}, { children: true }, function( err, results ){

                results.forEach( function( person ){

                  switch( person.name ){
                    case 'Tony':
                      compareItems( test, person._children.configId, data.c1 );
                    break;

                    case 'Chiara':
                      compareItems( test, person._children.configId, data.c2 );
                    break;

                    case 'Sara':
                      compareItems( test, person._children.configId, data.c2 );
                    break;

                    default:
                     test.ok( false, "Name not recognised?" ); 
                    break;                    
                  }
                });

                addressesR.select( {}, { children: true }, function( err, results ){

                  results.forEach( function( address ){

                    switch( address.street ){
                      case 'bitton':
                        compareItems( test, address._children.configId, data.c1 );
                      break;

                      case 'ivermey':
                        compareItems( test, address._children.configId, data.c2 );
                      break;

                      case 'samson':
                        test.ok( typeof( address._children.configId ) === 'undefined', "_children.configId should be undefined as configId is undefined" );
                      break;

                      default:
                       test.ok( false, "Street not recognised?" ); 
                      break;                    
                    }
                  });

                  return cb( null );;

                });
              });

            });
          };

          function updateSingleAddress( cb ){

            console.log("Running updateSingleAddress...");

            addressesR.update( { conditions: { and: [ { field: 'id', type: 'is', value: data.a1.id } ]  } }, { street: 'bitton CHANGED' }, { multi: false }, function( err ){

              test.ifError( err );

              data.a1 = {
                personId: data.p1.id,
                id: data.a1.id,
                street: 'bitton CHANGED',
                city: 'perth',
                configId: data.c1.id,
              }

              peopleR.select( {}, { children: true }, function( err, results ){

                results.forEach( function( person ){

                  switch( person.name ){
                    case 'Tony':
                      compareCollections( test, person._children.addressesR, [ data.a1, data.a2 ] );
                    break;

                    case 'Chiara':
                      compareCollections( test, person._children.addressesR, [ data.a3 ] );
                    break;

                    case 'Sara':
                      compareCollections( test, person._children.addressesR, [ ] );
                    break;

                    default:
                     test.ok( false, "Name not recognised?" ); 
                    break;                    
                  }
                });

                addressesR.select( {}, { children: true }, function( err, results ){
                  compareCollections( test, results, [ data.a1, data.a2, data.a3 ] );

                  return cb( null );;

                });
              });

            });
          };

          function updateMultipleAddresses( cb ){

            console.log("Running updateMultipleAddresses...");

            // This is skipped in mongoDb as it's not supported
            if( require('path').basename( process.env.PWD ) === 'simpledblayer-mongo' ){
              return cb( null );
            }

            console.log("DEBUG:");
            console.log( process.env );
           
            console.log( require('path').basename( process.env.PWD ) );
 
            // NOTE: This only works with 2.5 and up if using regexps
            // https://jira.mongodb.org/browse/SERVER-1155 (fixed in 2.5.3)
            addressesR.update( { conditions: { and: [ { field: 'city', type: 'eq', value: 'perth' } ]  } }, { city: 'perth2' }, { multi: true }, function( err ){

              test.ifError( err );

              data.a1 = {
                id: data.a1.id,
                personId: data.p1.id,
                street: 'bitton CHANGED',
                city: 'perth2',
                configId: data.c1.id,
              }

              data.a2 = {
                id      : data.a2.id,
                personId: data.p1.id,
                street  : 'samson',
                city    : 'perth2',
              };

              data.a3 = {
                id      : data.a3.id,
                personId: data.p2.id,
                street  : 'ivermey',
                city    : 'perth',
                configId: data.c2.id
              };


              peopleR.select( {}, { children: true }, function( err, results ){

                results.forEach( function( person ){

                  switch( person.name ){
                    case 'Tony':
                      compareCollections( test, person._children.addressesR, [ data.a1, data.a2 ] );
                    break;

                    case 'Chiara':
                      compareCollections( test, person._children.addressesR, [ data.a3 ] );
                    break;

                    case 'Sara':
                      compareCollections( test, person._children.addressesR, [ ] );
                    break;

                    default:
                     test.ok( false, "Name not recognised?" ); 
                    break;                    
                  }
                });

                addressesR.select( {}, { children: true }, function( err, results ){
                  compareCollections( test, results, [ data.a1, data.a2, data.a3 ] );

                  return cb( null );;

                });
              });

            });
          };





          function deleteSingleConfig( cb ){

            console.log("Running deleteSingleConfig...");

            configR.delete( { conditions: { and: [ { field: 'id', type: 'is', value: data.c2.id } ]  } }, { multi: false }, function( err ){

              test.ifError( err );

              peopleR.select( {}, { children: true }, function( err, results ){

                results.forEach( function( person ){

                  switch( person.name ){
                    case 'Tony':
                      compareItems( test, person._children.configId, data.c1 );
                    break;

                    case 'Chiara':
                      test.deepEqual( person._children.configId, {} );
                    break;

                    case 'Sara':
                      test.deepEqual( person._children.configId, {} );
                    break;

                    default:
                     test.ok( false, "Name not recognised?" ); 
                    break;                    
                  }
                });

                addressesR.select( {}, { children: true }, function( err, results ){

                  results.forEach( function( address ){

                    switch( address.street ){
                      case 'bitton CHANGED':
                        compareItems( test, address._children.configId, data.c1 );
                      break;

                      case 'ivermey':
                        test.deepEqual( address._children.configId, {} );
                      break;

                      case 'samson':
                        test.ok( typeof( address._children.configId ) === 'undefined', "Address with Samson doesn't have configId defined" );
                      break;

                      default:
                       test.ok( false, "Street not recognised?", address.street ); 
                      break;                    
                    }
                  });

                  return cb( null );;

                });
              });

            });
          };

          function deleteMultipleConfig( cb ){

            console.log("Running deleteMultipleConfig...");

            configR.delete( {}, { multi: true }, function( err ){

              test.ifError( err );

              peopleR.select( {}, { children: true }, function( err, results ){

                results.forEach( function( person ){

                  switch( person.name ){
                    case 'Tony':
                      test.deepEqual( person._children.configId, {} );
                    break;

                    case 'Chiara':
                      test.deepEqual( person._children.configId, {} );
                    break;

                    case 'Sara':
                      test.deepEqual( person._children.configId, {} );
                    break;

                    default:
                     test.ok( false, "Name not recognised?" ); 
                    break;                    
                  }
                });

                addressesR.select( {}, { children: true }, function( err, results ){

                  results.forEach( function( address ){

                    switch( address.street ){
                      case 'bitton CHANGED':
                        test.deepEqual( address._children.configId, {} );
                      break;

                      case 'ivermey':
                        test.deepEqual( address._children.configId, {} );
                      break;

                      case 'samson':
                        test.deepEqual( address._children.configId, {} );
                      break;

                      default:
                       test.ok( false, "Street not recognised?" ); 
                      break;                    
                    }
                  });

                  return cb( null );;

                });
              });

            });
          };

          function deleteSingleAddress( cb ){

            console.log("Running deleteSingleAddress...");

            addressesR.delete( { conditions: { and: [ { field: 'id', type: 'is', value: data.a3.id } ]  } }, { multi: false }, function( err ){

              test.ifError( err );

              peopleR.select( {}, { children: true }, function( err, results ){

                results.forEach( function( person ){

                  switch( person.name ){
                    case 'Tony':
                      compareCollections( test, person._children.addressesR, [ data.a1, data.a2 ] );
                    break;

                    case 'Chiara':
                      compareCollections( test, person._children.addressesR, [ ] );
                    break;

                    case 'Sara':
                      compareCollections( test, person._children.addressesR, [ ] );
                    break;

                    default:
                     test.ok( false, "Name not recognised?" ); 
                    break;                    
                  }
                });

                addressesR.select( {}, { children: true }, function( err, results ){
                  compareCollections( test, results, [ data.a1, data.a2 ] );

                  return cb( null );;

                });
              });

            });
          };

          function deleteMultipleAddresses( cb ){

            console.log("Running deleteMultipleAddresses...");

            addressesR.delete( { }, { multi: true }, function( err ){

              test.ifError( err );

              peopleR.select( {}, { children: true }, function( err, results ){

                results.forEach( function( person ){

                  switch( person.name ){
                    case 'Tony':
                      compareCollections( test, person._children.addressesR, [ ] );
                    break;

                    case 'Chiara':
                      compareCollections( test, person._children.addressesR, [ ] );
                    break;

                    case 'Sara':
                      compareCollections( test, person._children.addressesR, [ ] );
                    break;

                    default:
                     test.ok( false, "Name not recognised?" ); 
                    break;                    
                  }
                });

                addressesR.select( {}, { children: true }, function( err, results ){
                  compareCollections( test, results, [ ] );
                  return cb( null );;

                });
              });

            });
          };

 
          async.series( [ 

            insertFirstConfigRecord, 
            insertSecondConfigRecord,
            insertFirstPerson,
            insertFirstAddress,
            insertSecondAddress,
            insertSecondPerson,
            insertThirdPerson,
            insertThirdAddress,

            updateSingleConfig,
            updateMultipleConfig,
            updateSingleAddress,
            updateMultipleAddresses,

            deleteSingleConfig,
            deleteMultipleConfig,
            deleteSingleAddress,
            deleteMultipleAddresses,

          ], function( err ){
            test.ifError( err );

            test.done();
          });
        });  
      });
    },
  }



  if( typeof( makeExtraTests ) === 'function' ){
    
    // Copy tests over
    var extraTests = makeExtraTests( g );
    for( var k in extraTests ){
      tests[ k ] = extraTests[ k ];
    };
  };

  tests.finish = finish;

  return tests;
}


