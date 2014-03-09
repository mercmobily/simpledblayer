
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

var compareCollections = function( test, a, b ){

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
    test.fail( a, b, "Comparison failed", "recordset comparison" );
  }

  var res = ( a3 == b3 );

  if( ! res ){
    test.fail( a, b, "Record sets do not match", "recordset comparison" );
  }
  
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
        age    : { type: 'number', searchable: true, sortable: true },
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

        g.people = new g.Layer( 'people', { schema: g.commonPeopleSchema, idProperty: 'id' } );
		  	test.ok( g.people );

      } catch( e ){
        console.log("Error: couldn't create basic test layers, aborting all tests...");
        console.log( e );
        console.log( e.stack );
        process.exit();
      }


      // Test that it works also by passing the db in the constructor
      var LayerNoDb = declare( [ SimpleDbLayer, g.driver.DriverMixin ] );
      var peopleDb = new LayerNoDb( 'people', { schema: g.commonPeopleSchema, idProperty: 'id' } , g.driver.db );
      test.ok( peopleDb );
      test.ok( peopleDb.db === g.people.db );


      // Test that passing `db` will override whatever was in the prototype
      var fakeDb = { collection: function(){ return "some" } };
      var peopleRewriteDb = new g.Layer( 'people', { schema: g.commonPeopleSchema, idProperty: 'id' }, fakeDb );
      test.ok( fakeDb === peopleRewriteDb.db );

      // Test that not passing `db` anywhere throws
      test.throws( function(){        
        new LayerNoDb( 'people', { schema: g.commonPeopleSchema, idProperty: 'id' } );
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

        var people2 = new g.Layer( 'people', { schema: g.commonPeopleSchema, idProperty: 'id' } );
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


                g.people.update( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Lobily' } ] } }, { surname: 'Sobily' }, { deleteUnsetFields: true }, function( err, howMany ){

                  test.equal( howMany, 1 );

                  g.people.select( { conditions: { and: [ { field: 'surname', type: 'is', value: 'Sobily' } ] } },  function( err, results, total ){

                    console.log( results );

                    if( howMany === 1 ){
                      test.ok( typeof( results[ 0 ].name ) === 'undefined' || results[ 0 ].name === null || results[ 0 ].name ===  undefined );
                      test.ok( typeof( results[ 0 ].age ) === 'undefined' || results[ 0 ].age === null || results[ 0 ].age ===  undefined );
                    }

                    test.equal( total, 1 );

                    test.done();
                  })
                });
              })


            });
          })
        });
      })
    },

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
          searchable: {
          },
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
            config1  : { type: 'string', searchable: true, sortable: true, permute: true },
            config2  : { type: 'string', searchable: true, sortable: true, permute: true },
          }),
          idProperty: 'id',
        });

        // Zap DB and make up records ready to be added
 
        function prepareGround( cb ){

          async.eachSeries(
            [ peopleR, addressesR, configR ],
            function( item, cb){
              item.delete( { }, { multi: true }, cb );
            },
            function( err ){

              var ops = [];

              // Add three config records 

              var c1 = {
                config1: 'C1 - Config Line One',
                config2: 'C1 - Config Line Two'
              };
              g.driver.SchemaMixin.makeId( c1, function( err, id ) {
                test.ifError( err );
                c1.id = id;

                ops.push( { table: configR, op: 'insert', data: c1 } );

                var c2 = {
                  config1: 'C2 - Config Line One',
                  config2: 'C2 - Config Line Two'
                };
                g.driver.SchemaMixin.makeId( c2, function( err, id ) {
                  test.ifError( err );
                  c2.id = id;

                  ops.push( { table: configR, op: 'insert', data: c2 } );

                  var c3 = {
                    config1: 'C3 - Config Line One',
                    config2: 'C3 - Config Line Two'
                  };
                  g.driver.SchemaMixin.makeId( c3, function( err, id ) {
                    test.ifError( err );
                    c3.id = id;

                    ops.push( { table: configR, op: 'insert', data: c3 } );

                    // Add three people

                    var p1 = {
                      name   : 'Tony',
                      surname: 'Mobily',
                      age: 38
                    };
                    g.driver.SchemaMixin.makeId( p1, function( err, id ) {
                      test.ifError( err );
                      p1.id = id;
                      p1.motherId = p1.id;
                      p1.configId = c1.id;

                      ops.push( { table: peopleR, op: 'insert', data: p1 } );

                      var p2 = {
                        name   : 'Chiara',
                        surname: 'Mobily',
                        age: 24
                      };
                      g.driver.SchemaMixin.makeId( p2, function( err, id ) {
                        test.ifError( err );
                        p2.id = id;
                        p2.motherId = p1.id;
                        p2.configId = c1.id;

                        ops.push( { table: peopleR, op: 'insert', data: p2 } );

                        var p3 = {
                          name   : 'Sara',
                          surname: 'Fabbietti',
                          age:14 
                        };
                        g.driver.SchemaMixin.makeId( p3, function( err, id ) {
                          test.ifError( err );
                          p3.id = id;
                          p3.motherId = p3.id;
                          p3.configId = c2.id;

                          ops.push( { table: peopleR, op: 'insert', data: p3 } );

                         // Add three addresses

                          var a1 = {
                            personId: p1.id,
                            street  : 'bitton',
                            city    : 'perth',
                            configId: c1.id
                          };
                          g.driver.SchemaMixin.makeId( a1, function( err, id ) {
                            test.ifError( err );
                            a1.id = id;

                            ops.push( { table: addressesR, op: 'insert', data: a1 } );

                            var a2 = {
                              personId: p1.id,
                              street  : 'ivermey',
                              city    : 'perth',
                              configId: c2.id
                            };

                            g.driver.SchemaMixin.makeId( a2, function( err, id ) {
                              test.ifError( err );
                              a2.id = id;

                              ops.push( { table: addressesR, op: 'insert', data: a2 } );

                              var a3 = {
                                personId: p2.id,
                                street  : 'samson',
                                city    : 'perth',
                                configId: c3.id
                              };

                              g.driver.SchemaMixin.makeId( a3, function( err, id ) {
                                test.ifError( err );
                                a3.id = id;

                                ops.push( { table: addressesR, op: 'insert', data: a3 } );

                                // Change of address -- bitton
                                var a1c = {};
                                a1c.street = "bitton CHANGED";
                                a1c.personId = a1.personId;
                                a1c.id = a1.id;
                                ops.push( { deleteUnsetFields: false, table: addressesR, op: 'update', options: { multi: false }, data: a1c } );

                                // Change of address -- ivermey
                                var a2c = {};
                                a2c.street = "ivermey CHANGED";
                                a2c.personId = a2.personId;
                                a2c.id = a2.id;
                                ops.push( { deleteUnsetFields: false, table: addressesR, op: 'update', selector: { conditions: { and: [ { field: 'street', type: 'eq', value: 'ivermey' }   ]  } }, options: { multi: true }, data: a2c } );

 
                                var p1c = {}; for( var k in p1 ) p1c[ k ] = p1[ k ];
                                delete p1c.surname;
                                p1c.name = "Tony CHANGED";
                                p1c.configId = c2.id;
                                ops.push( { table: peopleR, op: 'update', data: p1c, deleteUnsetFields: true } );

                              /*
                                var c1c = {}; for( var k in c1 ) c1c[ k ] = c1[ k ];
                                c1c.config1 = "C1 - Config Line One CHANGED";
                                ops.push( { table: configR, op: 'update', data: c1c } );

                                ops.push( { 
                                  table: peopleR, 
                                  op: 'update', 
                                  data: { configId: c3.id },
                                  selector: { conditions: { and: [ { field: 'surname', type: 'eq', value: 'mobily' }   ]  }   },
                                  options: { multi: true },
                                 });

                               */
                                

                                ops.push( { table: addressesR, op: 'delete', data: a2 } );

                                // ops.push( { table: configR, op: 'delete', data: c2 } );
                                ops.push( { table: configR, op: 'delete', data: c2, selector: { conditions: { and: [ { field: 'config1', type: 'eq', value: 'C2 - Config Line One' }   ]  }  } } );


                                cb( null, ops );
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            }
          );

        }
        
        console.log("INITIALISING LAYERS..." );
        SimpleDbLayer.initLayers();

        SimpleDbLayer.getLayer('peopleR').makeAllIndexes( {}, function( err ){
          if( err ){
            console.log("Error building the indexes for peopleR!");
            console.log( err );
            process.exit(0);           
          }
        });

        Object.keys( SimpleDbLayer.registry ).forEach( function( k ) {

          var item = SimpleDbLayer.registry[ k ];
          console.log("\nK IS:", k );
          console.log("DEBUG1 ITEM: ",  item );
          console.log("Table: ", item.table );
          console.log("Searchable hash:", item._searchableHash );
          console.log("Permutation groups:", item._permutationGroups );
        });
        // Get started with the actual adding and testing
        prepareGround( function( err, ops ) {


        

          async.eachSeries(
            ops,
            function( item, cb ){
              if( item.op == 'insert' ){
                console.log("\n\n");
                console.log("INSERTING INTO", item.table.table );
                item.table.insert( item.data, cb );

              } else if( item.op == 'update' ){

                var options = item.options || {};
                var selector = item.selector || { conditions: { and: [ { field: 'id', type: 'eq', value: item.data.id }   ]  }   };
                if( item.deleteUnsetFields ) options.deleteUnsetFields = true;

                console.log("\n\n");
                console.log("UPDATING THIS", item.data, selector.conditions, options );

                item.table.update( selector, item.data, options, cb );

              } else if( item.op == 'delete' ){
                var selector = item.selector || { conditions: { and: [ { field: 'id', type: 'eq', value: item.data.id }   ]  }   };
                var options = item.options || {};

                console.log("\n\n");
                console.log("DELETING THIS", item.table.table, item.data.id );
                item.table.delete( { conditions: { and: [ { field: 'id', type: 'eq', value: item.data.id }   ]  }   }, options, cb );
              } else {
                cb( null );
              }
            },
            function( err ){
              test.ifError( err );

              test.done();
            }
          );
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


