
/*
Copyright (C) 2013 Tony Mobily

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var 
  dummy

, declare = require('simpledeclare')
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

var compareCollections = function( a, b ){


  try {
  var a1 = [], a2, a3;
  a.forEach( function( item ){
    a1.push( JSON.stringify( item ) );
  });
  a2 = a1.sort();
  a3 = JSON.stringify( a2 );

  var b1 = [], b2, b3;
  b.forEach( function( item ){
    b1.push( JSON.stringify( item ) );
  });
  b2 = b1.sort();
  b3 = JSON.stringify( b2 );
  } catch ( e ){
    console.log("Comparison failed:");
    console.log( e );
    return false;
  }

  var res = ( a3 == b3 && a.total == b.total );

  if( ! res ){
    console.log("Records differ:");
    i( a );
    console.log("Differs to:");
    i( b );
  }

  return res;
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



exports.get = function( getDbInfo, closeDb ){
  
  var tests;
  var g = {};

  var startup = function( test ){
    var self = this;

    test.doesNotThrow( function(){

      getDbInfo( function( err, db, DriverMixin ){
        if( err ){
          throw( new Error("Could not connect to db, aborting all tests") );
          process.exit();
        }

        // Set the important g.driver variables (db and DriverMixin)
        g.driver = {};
        g.driver.db = db;
        g.driver.DriverMixin = DriverMixin;

        test.done();

      });

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

        g.people = new g.Layer( 'people', {  name: true, surname: true, age: true } );
		  	test.ok( g.people );

        g.ranks = new g.Layer( 'ranks', {  name: true, rank: true } );
        test.ok( g.ranks );
      } catch( e ){
        console.log("Error: couldn't create basic test layers, aborting all tests...");
        console.log( e );
        console.log( e.stack );
        process.exit();
      }


      // Test that it works also by passing the db in the constructor
      var LayerNoDb = declare( [ SimpleDbLayer, g.driver.DriverMixin ] );
      var peopleDb = new LayerNoDb( 'people', {  name: true, surname: true, age: true }, g.driver.db );
      test.ok( peopleDb );
      test.ok( peopleDb.db === g.people.db );

      // Test that passing `db` will override whatever was in the prototype
      var fakeDb = { collection: function(){ return "some" } };
      var peopleRewriteDb = new g.Layer( 'people', {  name: true, surname: true, age: true }, fakeDb );
      test.ok( fakeDb === peopleRewriteDb.db );

      // Test that not passing `db` anywhere throws
      test.throws( function(){        
        new LayerNoDb( 'people', {  name: true, surname: true, age: true } );
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
          g.people.select( { conditions: { and: [ { field: 'name', type: 'is', value: 'Tony' }, { field: 'surname', type: 'is', value: 'Mobily' }, { field: 'age', type: 'is', value: 37 } ] } }, function( err, results ){ 

          test.ifError( err );

          var r = [ { name: 'Tony',      surname: 'Mobily',  age: 37 } ];
          r.total = 1;
          test.ok( compareCollections( results, r ) );
          
          test.done();
          
        /*  g.people.select( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ] } }, function( err, results ){
            test.ifError( err );

            var r = [ 
                      { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                      { name: 'Tony',      surname: 'Mobily',     age: 37 },
                      { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                    ];
            r.total = 3;
            //test.deepEqual( results, r );
            test.ok( compareCollections( results, r ) );

          })
         */

        })


      })
    },

    "selects, partial equality": function( test ){

      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        g.people.select( { conditions: { and: [ { field: 'surname', type: 'startsWith', value: 'Mob' } ] } }, function( err, results ){
          test.ifError( err );

          var r = [
                    { name: 'Tony',      surname: 'Mobily',     age: 37 },
                    { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                    { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                  ];
          r.total = 3;
          //test.deepEqual( results, r );
          test.ok( compareCollections( results, r ) );


          g.people.select( { conditions: { and: [ { field: 'surname', type: 'endsWith', value: 'nor' } ]  } }, function( err, results ){
            test.ifError( err );

            var r = [
              { name: 'Sara',  surname: 'Connor', age: 14 },
            ];
            r.total = 1;
            //test.deepEqual( results, r );
            test.ok( compareCollections( results, r ) )

            g.people.select( { conditions: { and: [ { field: 'surname', type: 'contains', value: 'on' } ] } }, function( err, results ){
              test.ifError( err );

              var r = [
                { name: 'Sara',  surname: 'Connor', age: 14 },
              ];
              r.total = 1;
              //test.deepEqual( results, r );
              test.ok( compareCollections( results, r ) )

              test.done();
            });
          });
        })
        
      })
    },

    "selects, comparisons": function( test ){

      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        g.people.select( { conditions: { and: [ { field: 'name', type: 'gt', value: 'M' } ] } }, function( err, results ){
          test.ifError( err );

          var r = [
            { name: 'Tony',      surname: 'Mobily',     age: 37 },
            { name: 'Sara',      surname: 'Connor',     age: 14 },
          ];
          r.total = 2;
          //test.deepEqual( results, r );
          test.ok( compareCollections( results, r ) );

          g.people.select( { conditions: { and: [ { field: 'age', type: 'gt', value: 22 } ] } }, function( err, results ){
            test.ifError( err );

            var r = [
              { name: 'Tony',      surname: 'Mobily',     age: 37 },
              { name: 'Daniela',   surname: 'Mobily',     age: 64 },
            ];
            r.total = 2;
            //test.deepEqual( results, r );
            test.ok( compareCollections( results, r ) );


            g.people.select( { conditions: { and: [ { field: 'age', type: 'gte', value: 22 } ] } }, function( err, results ){
              test.ifError( err );

              var r = [
                { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                { name: 'Tony',      surname: 'Mobily',     age: 37 },
                { name: 'Daniela',   surname: 'Mobily',     age: 64 },
              ];
              r.total = 3;
              //test.deepEqual( results, r );
              test.ok( compareCollections( results, r ) );


              g.people.select( { conditions: { and: [ { field: 'age', type: 'gt', value: 22 }, { field: 'age', type: 'lt', value: 60 }] } }, function( err, results ){
                test.ifError( err );

                var r = [
                 { name: 'Tony',      surname: 'Mobily',     age: 37 },
                ];
                r.total = 1;
                //test.deepEqual( results, r );
                test.ok( compareCollections( results, r ) );

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
        g.people.select( { ranges: { limit: 1 } }, function( err, results ){
          test.ifError( err );

          test.deepEqual( results.total, 1 );

          g.people.select( { ranges: { limit: 2 } }, function( err, results ){
            test.ifError( err );
            test.deepEqual( results.total, 2 );


            g.people.select( { ranges: { from: 1, to: 3 } }, function( err, results ){
              test.ifError( err );
              test.deepEqual( results.total, 3 );
    

              g.people.select( { ranges: {  to: 2 } }, function( err, results ){
                test.ifError( err );
                test.deepEqual( results.total, 3 );

                g.people.select( { ranges: { from: 1 } }, function( err, results ){
                  test.ifError( err );
                  test.deepEqual( results.total, 3 );

                  g.people.select( { ranges: { to: 4, limit: 2 } }, function( err, results ){
                    test.ifError( err );
                    test.deepEqual( results.total, 2 );

                    g.people.select( { ranges: { from: 1, to: 4, limit: 2 } }, function( err, results ){
                      test.ifError( err );
                      test.deepEqual( results.total, 2 );
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

        g.people.select( { sort: { name: 1 } }, function( err, results ){
          test.ifError( err );

          var r =  [
            { name: 'Chiara',    surname: 'Mobily',     age: 22 },
            { name: 'Daniela',   surname: 'Mobily',     age: 64 },
            { name: 'Sara',      surname: 'Connor',     age: 14 },
            { name: 'Tony',      surname: 'Mobily',     age: 37 },
          ];
          r.total = 4;
          test.deepEqual( results, r );


          g.people.select( { sort: { surname: 1, name: 1 } }, function( err, results ){
            test.ifError( err );

            var r =  [
              { name: 'Sara',      surname: 'Connor',     age: 14 },
              { name: 'Chiara',    surname: 'Mobily',     age: 22 },
              { name: 'Daniela',   surname: 'Mobily',     age: 64 },
              { name: 'Tony',      surname: 'Mobily',     age: 37 },
            ];
            r.total = 4;
            test.deepEqual( results, r );


            g.people.select( { ranges: { limit: 2 },  sort: { surname: -1, age: -1 } }, function( err, results ){
              test.ifError( err );

              var r =  [
                { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                { name: 'Tony',      surname: 'Mobily',     age: 37 },
              ];
              r.total = 2;
              test.deepEqual( results, r );
              //test.ok( compareCollections( results, r ) );


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
  
          test.notEqual( cursor, null );
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

        g.people.select( { },  function( err, results ){
          test.ifError( err );
  
          var r =  [
            { name: 'Chiara',    surname: 'Mobily',     age: 22 },
            { name: 'Tony',      surname: 'Mobily',     age: 37 },
            { name: 'Sara',      surname: 'Connor',     age: 14 },
            { name: 'Daniela',   surname: 'Mobily',     age: 64 },
          ];
          r.total = 4;
          //test.deepEqual( results, r );
          test.ok( compareCollections( results, r ) );


          
          g.people.delete( { conditions: { and: [ { field: 'name', type: 'is', value: 'DOES NOT EXIST' } ] }  },  function( err, howMany ){
            test.ifError( err );
 
            test.equal( howMany, 0 );

            g.people.delete( { conditions: { and: [ { field: 'name', type: 'is', value: 'Tony' } ] }  },  function( err, howMany ){
              test.ifError( err );
   
              test.equal( howMany, 1 );
  
              g.people.select( { },  function( err, results ){
                test.ifError( err );
    
                var r =  [
                  { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                  { name: 'Sara',      surname: 'Connor',     age: 14 },
                  { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                ];
                r.total = 3;
                //test.deepEqual( results, r );
                test.ok( compareCollections( results, r ) );

  
  
                g.people.delete( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ] }  }, { multi: true }, function( err, howMany){
                  test.ifError( err );
    
                  test.equal( howMany, 2 );
  
                  g.people.select( { },  function( err, results ){
                    test.ifError( err );
    
                    var r =  [
                      { name: 'Sara',      surname: 'Connor',     age: 14 },
                    ];
                    r.total = 1;
                    //test.deepEqual( results, r );
                    test.ok( compareCollections( results, r ) );

  
                    clearAndPopulateTestCollection( g, function( err ){
                      test.ifError( err );
  
                      g.people.delete( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ] }, sort: { name: -1 }   }, function( err, howMany ){
                        test.ifError( err );
    
                        test.deepEqual( howMany, 1 );
  
                        g.people.select( { },  function( err, results ){
                          test.ifError( err );
   
                          var r =  [
                            { name: 'Chiara',    surname: 'Mobily',     age: 22 },
                            //{ name: 'Tony',      surname: 'Mobily',     age: 37 },
                            { name: 'Sara',      surname: 'Connor',     age: 14 },
                            { name: 'Daniela',   surname: 'Mobily',     age: 64 },
                          ];
                          r.total = 3;
                          //test.deepEqual( results, r );
                          test.ok( compareCollections( results, r ) );

   
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

    "updates": function( test ){
      clearAndPopulateTestCollection( g, function( err ){
        test.ifError( err );

        g.people.update( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Mobily' } ] } }, { surname: 'Tobily' }, { multi: true }, function( err, howMany ){
          test.deepEqual( howMany, 3 );

          g.people.select( { },  function( err, results ){
            var r =  [
              { name: 'Chiara',    surname: 'Tobily',     age: 22 },
              { name: 'Tony',      surname: 'Tobily',     age: 37 },
              { name: 'Sara',      surname: 'Connor',     age: 14 },
              { name: 'Daniela',   surname: 'Tobily',     age: 64 },
            ];
            r.total = 4;
            //test.deepEqual( results, r );
            test.ok( compareCollections( results, r ) );


            g.people.update( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Tobily' } ] }, sort: { name: -1 }  }, { surname: 'Lobily' }, function( err, howMany ){
              test.deepEqual( howMany, 1 );

              g.people.select( { },  function( err, results ){
                var r =  [
                  { name: 'Chiara',    surname: 'Tobily',     age: 22 },
                  { name: 'Tony',      surname: 'Lobily',     age: 37 },
                  { name: 'Sara',      surname: 'Connor',     age: 14 },
                  { name: 'Daniela',   surname: 'Tobily',     age: 64 },
                ];
                r.total = 4;
                //test.deepEqual( results, r );
                test.ok( compareCollections( results, r ) );


                g.people.update( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Lobily' } ] } }, { surname: 'Sobily' }, { deleteUnsetFields: true }, function( err, howMany ){
                  test.deepEqual( howMany, 1 );

                  g.people.select( { },  function( err, results ){
                    var r =  [
                      { name: 'Chiara',    surname: 'Tobily',     age: 22 },
                      { surname: 'Sobily' },
                      { name: 'Sara',      surname: 'Connor',     age: 14 },
                      { name: 'Daniela',   surname: 'Tobily',     age: 64 },
                    ];
                    r.total = 4;
                    //test.deepEqual( results, r );
                    test.ok( compareCollections( results, r ) );


                    test.done();
                  })
                });
              })
            });
          })
        });
      })
    },


    finish: finish 

  }    

  return tests;
}


