
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

    "welcome message": function( test ){
      console.log("Testing starts now. Let's do it!");
      test.done();
    },

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

    "clear data": function( test ){
      g.people.delete( { }, { multi: true }, function( err, howmany ){
        test.ifError( err );
        test.done();
      });
    },

    "populate": function( test ){
     test.done();
    },

    finish: finish 

  }    


  return tests;
}


/*
  

exports.createLayer = {

  
  },

  insert: function( test ){
    var people = [
      { name: 'Chiara',    surname: 'Mobily',     age: 24 },
      { name: 'Tony',      surname: 'Mobily',     age: 37 },
      { name: 'Sara',      surname: 'Connor',     age: 14 },
      { name: 'Daniela',   surname: 'Mobily',     age: 64 },
    ];

    returnedPeople = [];

    var functions = [];

    // Populate the database
    people.forEach( function( person ){

      functions.push( function( done ){
        layer.insert( person, { returnRecord: true }, function( err, person ){
          test.ifError( err );
          returnedPeople.push( person );
          done( null );
        })
      })

    })

    async.series( functions, function( err, res ){
      test.ifError( err );
      test.done();
    });

  },

} 
*/
