simpledblayer
=============

SimpleDbLayer is a module that will allow you to connect and query a DB server. Key features:

* It doesn't manage connections. You will have to create a connection to the database and pass it
* Simple querying. You cannot create complex queries with nested ANDs and ORs -- only one level of AND and OR. You can however check for equality, greater/smaller than, starts with/ends with/contains, etc. as well as sorting and limiting/ranges
* It has full cursor support
* It is schema-free. You only need to tell it what fields are there -- schema definition is 100% not dealt with
* It is written with very simple, Object Oriented code using [simpleDeclare](https://github.com/mercmobily/simpleDeclare)
* 

# How to use it

## Connection

SimpleDbLayer does NOT handle DB connections for you. It's your responsibility to connect to the database and pass the connection object to it.
For MongoDB, you can use MongoWrapper that does just that for you:

    var mw = require('mongowrapper');
    mw.connect('mongodb://localhost/hotplate', {}, function( err, db ){
     // ...
    });


## Make up the DB Layer class

In order to use this class, you will need to _mixin_ the basic SimpleDbLayer class and a DB-specific mixin. If you are not used to mixins, don't be scared: it's simpler than it sounds.

Here is how you make up the class:

    // Include the necessary modules
    var mw = require('mongowrapper');
    var declare = require('simpledeclare');
    var SimpleDbLayer = require('./SimpleDbLayer');
    var MongoMixin = require('./MongoMixin.js');

    // Connect to the database
    mw.connect('mongodb://localhost/someDB', {}, function( err, db ){

      // Make up the database class
      var DbLayer = declare( [ SimpleDbLayer, MongoMixin ], { db: db } );

    });



## Create your model object

Once you have your DbLayer class, it's up to you to create objects which will then "talk" to the database:

    // Include the necessary modules
    var mw = require('mongowrapper');
    var declare = require('simpledeclare');
    var SimpleDbLayer = require('./SimpleDbLayer');
    var MongoMixin = require('./MongoMixin.js');

    // Connect to the database
    mw.connect('mongodb://localhost/someDB', {}, function( err, db ){

      // Make up the database class
      var DbLayer = declare( [ SimpleDbLayer, MongoMixin ], { db: db } );

        var people = new DbLayer( 'people', {  name: true, surname: true, age: true } );

    });

Note how `people` is an object which will be tied to the table/collection `people`. The second parameter in the constructor is the list of fields in the table -- note that this is _not_ a schema definition.

## Create your model object with a specific db connection

You can pass the connection variable `db` variable to the DbLayer constructor if you like:

    var logEntries = new DbLayer( 'logger', {  entry: true, datestamp: true }, someOtherDb );

In this case, logEntries will be tied to the table `logger`, but queries will be directed to `someOtherDb` rather than `db`.


## Querying: insert

To insert data into your table:

    people.insert( { name: 'Tony', age: 37 }, { returnRecord: true }, function( err, record ){

The second parameter is optional. If you pass it, and `returnRecord` is true, then the callback will be called with `record` representing the record just created.


## Querying: select

For normal queries:

    people.select( {}, { useCursor: false , delete: false }, function( err, data ){

For cursor queries:

    people.select( {}, { useCursor: true , delete: false }, function( err, cursor ){

Normal queries will just return the data as an array of values. Cursor queries will return an object with the methods next(), rewind() and close(). For example:

    people.select( {}, { useCursor: true , delete: false }, function( err, cursor ){
    if( err ){
      next err
    } else {
      cursor.next( err, record ){
        if( err ){
          next( err );
        } else {
          console.log( "The first record:" );
          console.log( record );
        } 
      }
    }
   
If the `delete` field is on (it's off by default), the driver will _delete_ any fetched record. For straight selects, it will delete all records _before_ calling your callback. For cursor-driven selects, it will delete records as they are fetched with `cursor.next()` 

This is what the search filter can look like:

    var searchFilter = { 
  
      ranges: {
        from: 1,
        to: 7
        limit: 7
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

Ranges can have `from`, `to` and `limit` set. If `limit` or `to` are missing, they are automatically worked out.
For sorting, -1 means from smaller to bigger and 1 means from bigger to smaller.

Conditions are grouped into `and` and `or` ones. The query will be a flat list of conditions, where `and` ones will typically take precedence. The possibly `types` are: `lt` `lte` `gt` `gte` `is` `startWith` `startsWith` `contain` `contains` `endsWith` `endWith``


## Querying: delete

To delete, just use the `delete()` method:

    people.delete( { conditions: { age: { type: 'lt', value: 30 } } }, { multi: true } ,  function( err, howMany ){

Please note that if the `multi` flag is on, then it will delete multiple records. Also, the second `options` parameter is optional.

## Querying: update

This is a simple update:

    people.update( { conditions: { and: { name: { type: 'startsWith', value: 'D' }  } } }, { name: 'Changed' }, { deleteUnsetFields: true, multi: true }, function( err, num ){

If `multi` is set to `true`, all records matching the search will be updated. Otherwise, only one record will be updated.
If `deleteUnsetFields` is set to `true`, then any fields that are defined as valid fields for the collection, but ar _not_ defined in the update object, will be zapped. So, if your record is `{ name: 'Tony', age: 37 }` and you run an update with `deleteUnsetFields` set to true and with the update record set as `{ name: 'Tony2' }`, the new record will become `{ name: 'Tony2 }`. If `deleteUnsetFields` is set to `false`, the resul would be `{name: Tony2, age: 37 }` (unset records are not zapped).




