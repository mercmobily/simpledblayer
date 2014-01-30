simpledblayer
=============

SimpleDbLayer is a module that will allow you to connect and query a DB server. Key features:

* It doesn't manage connections. You will have to create a connection to the database and pass it
* Simple querying. You cannot create complex queries with nested ANDs and ORs -- only one level of AND and OR. You can however check for equality, greater/smaller than, starts with/ends with/contains, etc. as well as sorting and limiting/ranges
* It has full cursor support
* It is schema-free. You only need to tell it what fields are there and if they are searchable -- schema definition is 100% NOT dealt with
* It is written with very simple, Object Oriented code using [simpleDeclare](https://github.com/mercmobily/simpleDeclare)

# How to use it

## DB connection

SimpleDbLayer does NOT handle DB connections for you. It's your responsibility to connect to the database and pass the connection object to it.
For MongoDB, you can use Mongo's connect call:

    var mongo = require('mongo');
    mongo.MongoClient.connect( 'mongodb://localhost/hotplate', {}, function( err, db ){
     // db exists here
    }; 


Or for Tingodb just create the DB object:

    var tingo = require("tingodb")({});
    var db = new tingo.Db('/tmp/someDB', {} );
    // db exists here

## Make up the DB Layer class

In order to use this class, you will need to _mixin_ the basic SimpleDbLayer class and a DB-specific mixin. If you are not used to mixins, don't be scared: it's simpler than it sounds.

Here is how you make up the class:

    var mongo = require('mongodb');

    var declare = require('simpledeclare');
    var SimpleDbLayer = require('simpledblayer'); // This is the main class
    var SimpleDbLayerMongo = require('simpledblayer-mongo'); // This is the layer-specific mixin

    // Connect to the database
    mongo.MongoClient.connect('mongodb://localhost/someDB', {}, function( err, db ){

      // Make up the database class
      var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );

      // ...your program goes here

    });

Or, you could use TingoDB:

    var tingo = require("tingodb")({});

    var declare = require('simpledeclare');
    var SimpleDbLayer = require('simpledblayer'); // This is the main class
    var SimpleDbLayerTingo = require('simpledblayer-tingo'); // This is the layer-specific mixin

    var db = new tingo.Db('/tmp/someDB', {} );

    // Make up the database class
    var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerTingo ], { db: db } );

    // ...your program goes here

There is no difference in functionality between the two layers.

## Create your model object

Once you have your DbLayer class, it's up to you to create objects which will then modify specific database tables/collections:

    var people = new DbLayer( 'people', {  name: true, surname: true, age: true } );

Note how `people` is an object which will be tied to the table/collection `people`.

The second parameter in the constructor is the list of fields in the table -- note that this is _not_ a schema definition. However:

* Each key in the hash will be a valid, savable field
* If the corresponding value is set to a `true`ly one, then the field is also searchable
* If the corresponding value is set to `null`, then the field will be valid and savable, but it will not be returned by queries (it will be "invisible"). This is especially useful for "position" fields, that need to be defined and editable, but mustn't be returned by queries)

## Create your model object with a specific db connection

You can pass the connection variable `db` as the third parameter of the DbLayer constructor if you like:

    var logEntries = new DbLayer( 'logger', {  entry: false, datestamp: true }, someOtherDb );

In this case, logEntries will be tied to the table `logger`, but queries will be directed to `someOtherDb` rather than `db`.

## Setting a hard limit on queries

Cursor-less queries on large data sets will likely chew up huge amounts of memory. This is why you can set a hard limit on queries:

      var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db, hardLimitOnQueries: 10 } );

This will imply that each non-cursor query will only ever return 10 items max. You can also set this limit on specific objects:

      var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );
      var people = new DbLayer( 'people', {  name: true, surname: true, age: true } );
      people.hardLimitOnQueries = 10;

Note that hardLimtOnQueries only ever applies to non-cursor queries.

## Querying: insert

To insert data into your table:

    people.insert( { name: 'Tony', age: 37 }, { returnRecord: true }, function( err, record ){

The second parameter is optional. If you pass it, and `returnRecord` is true, then the callback will be called with `record` representing the record just created.

## Querying: select

For normal queries:

    people.select( {}, { useCursor: false , delete: false }, function( err, data, total, grandTotal ){

In normal queries, you can also pass the `skipHardLimitOnQueries` flag. However, remember that if you have a large data set, non-cursor queries will attempt to place the whole thing in memory and will probably kill your server:

    people.select( {}, { useCursor: false , delete: false, skipHardLimitOnQueries: true }, function( err, data, total, grandTotal ){

For cursor queries (for which `skipHardLimitOnQueries` is implied since it would be pointless):

    people.select( {}, { useCursor: true , delete: false }, function( err, cursor, total, grandTotal ){


Here, `total` is the number of records returned, and `grandTotal` is the _total_ number of records that satisfy the query without taking into consideration the required ranges.

Normal queries will just return the data as an array of values. Cursor queries will return an object with the methods next(), rewind() and close(). For example:

    people.select( {}, { useCursor: true , delete: false }, function( err, cursor ){
    if( err ){
      console.log( "ERROR!", err );
    } else {
      cursor.next( function( err, record ){
        if( err ){
          console.log( "ERROR!", err );
        } else {
          console.log( "The first record:" );
          console.log( record );
        } 
      }
    }

This is what the search filter can look like:

    var searchFilter = { 
  
      ranges: {
        from: 1,
        to: 7
        limit: 7
      },
  
      conditions: {
  
        and: [
          { 
            field: 'name',
            type: 'startsWith',
            value: 'To'
          },
        ],
  
        or: [
  
          {
            field: 'age',
            type: 'lt',
            value: 12 
          },
          {
            field: 'age',
            type: 'gt',
            value: 65
          },

        ],
      },
  
      sort: {
        name: -1,
        age: 1
      }
  
    };

Conditions are grouped into `and` and `or` ones. The db query will be the list of `and` conditions _linked with `and`_ to the list of `or` conditions. See it as `A and B and C and (D or E of F )` where `A`, `B` and `C` are the `and` conditions, and `D`, `E`, `F` are the `or` conditions.

The possible comparison types are: `is` `eq` `lt` `lte` `gt` `gte` `startWith` `startsWith` `contain` `contains` `endsWith` `endWith`.

If the `delete` field is on (it's off by default), the driver will _delete_ any fetched record. For straight selects, it will delete all records _before_ calling your callback. For cursor-driven selects, it will delete records as they are fetched with `cursor.next()` 

Ranges can have `from`, `to` and `limit` set. If `fields` are missing, the others are automatically worked out.
For sorting, -1 means from smaller to bigger and 1 means from bigger to smaller.

## Querying: delete

To delete, just use the `delete()` method:

    people.delete( { conditions: { age: { type: 'lt', value: 30 } } }, { multi: true } ,  function( err, howMany ){

Please note that if the `multi` flag is on, then it will delete multiple records. Also, the second `options` parameter is optional.

## Querying: update

This is a simple update:

    people.update( { conditions: { and: [ name: { type: 'startsWith', value: 'D' }  ] } }, { name: 'Changed' }, { deleteUnsetFields: true, multi: true }, function( err, num ){

If `multi` is set to `true`, all records matching the search will be updated. Otherwise, only one record will be updated.
If `deleteUnsetFields` is set to `true`, then any fields that are defined as valid fields for the collection, but ar _not_ defined in the update object, will be zapped. So, if your record is `{ name: 'Tony', age: 37 }` and you run an update with `deleteUnsetFields` set to true and with the update record set as `{ name: 'Tony2' }`, the new record will become `{ name: 'Tony2 }`. If `deleteUnsetFields` is set to `false`, the resul would be `{name: Tony2, age: 37 }` (unset records are not zapped).

# Indexing

You can create and delete indexes using SimpleDbLayer.
The methods are:

## `makeIndex( keys, options )`

The method `makeIndex` will create an index. When calling the function:

* `keys` is an hash where each key is the field name, and each value can be `1` (ascending order) or `-1` (descending order). So, if you have `{ name: 1, surname: 1 }`, the database will be instructed to create an index with the fields `name` and `surname`, both in ascending order.

* `options` is a hash where: `{ background: true }` will start the process in background; `unique` will instruct the database that the index will need to be unique; `name` will force the index name to a specific label, rather than the database's default.

## `dropAllIndexes()`

The method `dropAllIndexes` will drop all indexes for the table/collection.

# Why another DB abstraction module?

This module was specificaly created to allow the [JsonRestStores](https://github.com/mercmobily/JsonRestStores) module to interact with several database engines. It's very minimalistic, it doesn't allow complex querying but it does cover most needs in non-complex data structures.

If you are after a full-blown database abstraction module, you should look somewhere else.

# Position fields

This module allows has a handy function that deals with "relocating":

    relocation: function( positionField, idProperty, id, moveBeforeId, cb ){

This function takes:

* `positionField`. The field that will be used to store the elements' positions
* `idProperty`. The ID property that will be used for record lookups
* `id`. The ID of the record to be relocated 
* `moveBeforeId`. The record before which `id` will be placed. Note that if `moveBeforeId` is `undefined` or `null`, the item will be placed last.

The result is that the `positionField` field of each record is set in such a way so that the element with idProperty `id` is placed before the element with idProperty `moveBeforeId`.



