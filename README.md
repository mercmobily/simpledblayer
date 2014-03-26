simpledblayer
=============

SimpleDbLayer is a module that will allow you to connect and query a DB server. Key features:

* It doesn't manage connections. You will have to create a connection to the database and pass it
* Simple querying. You cannot create complex queries with nested ANDs and ORs -- only one level of AND and OR. You can however check for equality, greater/smaller than, starts with/ends with/contains, etc. as well as sorting and limiting/ranges
* It has full cursor support
* It uses a schema to cast/validate fields.
* It allows 1-level joins in queryes and data fetching. This means that you can load a record and have all of its "lookup" fields, or all of its 1:n children, pre-loaded.
* It is written with very simple, Object Oriented code using [simpleDeclare](https://github.com/mercmobily/simpleDeclare)


## TODO

Todo when everything is stable and non-structural, non-API-changing changes can be made:

* searchableHash -> change it to the field type, 'string', 'id', etc.
* make DB a normal parameter, rather than the constructor's third parameter
* take out "join" for lookup tables, since it can be inferred easily
* make `children`, `chldrenField` definable as a parameter as well as class

# Creating a layer

## Create a DB connection

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
    var SimpleSchema = require('simpleschema'); // This will be used to define the schema
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
    var SimpleSchema = require('simpleschema'); // This will be used to define the schema
    var SimpleDbLayerTingo = require('simpledblayer-tingo'); // This is the layer-specific mixin

    var db = new tingo.Db('/tmp/someDB', {} );

    // Make up the database class
    var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerTingo ], { db: db } );

    // ...your program goes here

There is no difference in functionality between the two layers.

## Create your layer object

Once you have your DbLayer class, it's up to you to create objects which will then modify specific database tables/collections:

    var people = new DbLayer( 'people', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        name: { type: 'string', required: true },
        surname: { type: 'string', searchable: true },
        age: { type: 'number', searchable: true },
      }),

      idProperty: 'id',

    } );

Note how `people` is an object which will be tied to the table/collection `people`.
The second parameter in the constructor is a set of parameters, which in this case include 1) The schema definition 2) the `idProperty`, which needs to be set and refer to an existing field.

Simpleschema is an object based on [SimpleSchema](https://github.com/mercmobily/SimpleSchema), which provides a way to define extensible schemas with a very simple API. In this case, the `name` field is required whereas `surname` and `age` are not required but are searchable.

The `id` field, since it was set as `isProperty`, is forced as `required` and `searchable`.

## Create your layer object with a specific db connection

You can pass the connection variable `db` as the third parameter of the DbLayer constructor if you like:

    var logEntries = new DbLayer( 'logger', { ...layer parameters... }, someOtherDb );

In this case, logEntries will be tied to the table `logger`, but queries will be directed to `someOtherDb` rather than `db`.

## Setting a hard limit on queries

Cursor-less queries on large data sets will likely chew up huge amounts of memory. This is why you can set a hard limit on queries:

      var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db, hardLimitOnQueries: 10 } );

This will imply that each non-cursor query will only ever return 10 items max. You can also set this limit on specific objects by passing hardLimitOnQueries as a parameter:

    var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );
    var people = new DbLayer( 'people', {  ...layer parameters..., hardLimitOnQueries: 10 } );

Note that hardLimtOnQueries only ever applies to non-cursor queries.

## Validation errors

The `insert` and `update` operations will trigger validation against the schema. If validation fails, the callback is called with an error. The error object is created by SimpleDbLayer like this:

    var error = new Error( { errors: errorsArray } );
    error.errors = errorsArray;

The variable `errorsArray` is an array of objects, where each object has `field` and `message` defined. For example:

    [ { field: 'age', message: 'Age is invalid' }, { field: 'name', message: 'Field is required: name' } ] 

You can set the constructor used to create the error objects by passing a `SchemaError` parameter when you define the layer:

    var people = new DbLayer( 'people', {

      schema: new SimpleSchema({
        // ... your schema here
      }),

      idProperty: 'id',

      SchemaError: YourPersonalisedErrorConstructor
    } );

You can also define a `SchemaError` that will be used by all instances:

    var people = new DbLayer( 'people', {  ...layer parameters..., SchemaError: SomeOtherSchemaError } );

# Running queries

## Querying: insert

To insert data into your table:

    people.insert( { id: 1, name: 'Tony', surname: 'Mobily', age: 37 }, { returnRecord: true }, function( err, record ){

The second parameter is optional. If you pass it:

* If `returnRecord` is true, then the callback will be called with `record` representing the record just created.
* If `skipValidation` is true, then the validation of the data against the schema will be skipped

## Querying: update

This is a simple update:

    people.update( { conditions: { and: [ name: { type: 'startsWith', value: 'D' }  ] } }, { name: 'Changed' }, { deleteUnsetFields: true, multi: true }, function( err, num ){

The second parameter is optional. If you pass it:

* If `multi` is set to `true`, all records matching the search will be updated. Otherwise, only one record will be updated.
* If `deleteUnsetFields` is set to `true`, then any field that is not defined in the update object will be set as empty in the database. Basically, it's a "full record update" regardless of what was passed. Validation will fail if a field is required by the schema and it's not set while this option is `true`.
* If `skipValidation` is true, then the validation of the data against the schema will be skipped

## Querying: delete

To delete, just use the `delete()` method:

    people.delete( { conditions: { and: [ { field: 'age', type: 'lt', value: 30 }, { field: 'name', type: 'eq', value: 'Chiara' } ] } }, { multi: true } ,  function( err, howMany ){

The second parameter is optional. If you pass it:

* If `multi` is set to `true`, all records matching the search will be deleted. Otherwise, only one record will be deleted.

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

# Automatic loading of children (joins)

SimpleDbLayer does _not_ support complex joins. In fact, at the beginning it didn't support joins at all. However, after real world usage of the library, it became apparent that some level of joins was important to easy application development.

## Define nested layers

You can now define a layer as "child" of another one:

    var people = new DbLayer( 'people', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        name: { type: 'string', required: true },
        surname: { type: 'string', searchable: true },
        age: { type: 'number', searchable: true },
      }),

      idProperty: 'id',

      nested: [
        {
          layer: 'emails',
          join: { personId: 'id' },
          type: 'multiple',
        },
      ]

    } );

    var emails = new DbLayer( 'emails', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        personId: { type: 'id' },
        email: { type: 'string', required: true },
      }),

      idProperty: 'id',

      nested: [
        {
          layer: 'people',
          type: 'lookup',
          join: { id: 'personId' },
          parentField: 'personId',
        }
      ],
    } );

    SimpleDbLayer.initLayers(); // <--- IMPORTANT!!!


***It's absolutely crucial that you run `SimpleDbLayer.initLayers()` before running queries if you have nested layers.***

As you can see, each layer is created with an extra `nested` parameter, which defines:

* `layer`. The layer you want to automatically load records from
* `type`. How you want to load your records. If you use `multiple`, SimpleDbLayer will auto-load all children records; with `lookup`, it will only load one record
* `join`. How the record will be looked up in the parent table. It's a hash object, where the key is the field _foreign_ to the layer that is being defined, and the value is the field _local_ to the layer that is being defined.
* `parentField`. Only required when `type` is `lookup`, this is the name of the field in the `local` layer that is being defined that will be used.

This functionality affects `select()` calls: basically, every time you fetch records, SimpleDbLayer will return a record with a `_children` hash.

## Getting the results

Assume that you insert:

    people.insert( {

      id: 100,
      name: 'Tony',
      surname: 'Mobily',
      age: 37

    }, { returnRecord: true }, function( err, record ){
    
      if( err ) return cb( err );

      email.insert( {

        id: 10,
        personId: 100,
        email: 'tony@example.com'

      }, { returnRecord: true }, function( err, record ){
        if( err ) return cb( err );

      email.insert( {

        id: 11,
        personId: 100,
        email: 'tonyAnotherOne@example.com'

      }, { returnRecord: true }, function( err, record ){
        if( err ) return cb( err );

        //...

When fetching the person with id 100:

    people.select( { conditions: { and: [ { field: 'id', type: 'eq', value: 100 } ] } }, { children: true }, function( err, data ){


Since `children: true` is passed in the option, this will be returned:

    {
      id: 100,
      name: 'Tony',
      surname: 'Mobily',
      age: 37,
      _children: {
        emails: [
        
          {
            id: 10,
            personId: 100,
            email: 'tony@example.com'
            _children: {},
          },

          {
            id: 11,
            personId: 100,
            email: 'tonyAnotherOne@example.com'
            _children: {},
          }

        ],

      }
    }


When fetching the email with id 10:

    emails.select( { conditions: { and: [ { field: 'id', type: 'eq', value: 10 } ] } }, { children: true }, function( err, data ){

, it will return:

    {    
      id: 10,
      personId: 100,
      email: 'tony@example.com',
      _children: {

        personId: {
          id: 100,
          name: 'Tony',
          surname: 'Mobily',
          age: 37
        },
      }
    }

Finally, you can change the name of the `_children` field when instantiating the class, by setting a different `childrenField` attribute:

    var people = new DbLayer( 'people', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        name: { type: 'string', required: true },
        surname: { type: 'string', searchable: true },
        age: { type: 'number', searchable: true },
      }),

      idProperty: 'id',

      nested: [
        {
          layer: 'emails',
          join: { personId: 'id' },
          type: 'multiple',
        },
      ]

      childrenField: '_children',
    } );


# Positioning

When records are fetched (using `select`) without chosing any `sort`ing options, they are returned in random order. However, in web applications you often want to decide the `placement` of an element, in order to allow drag&drop sorting etc.

Positioning is tricky to manage from the application layer, as changing a field's position requires the update of several records in the database. This is why SimpleDbLayer handles positioning for you.

## Basic positioning

If you have a "flat" table, you can simply define the `positionField` attribute when you define the constructor:

    var people = new DbLayer( 'people', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        name: { type: 'string', required: true },
        surname: { type: 'string', searchable: true },
        age: { type: 'number', searchable: true },
      }),

      idProperty: 'id',

      positionField: 'position',
    } );

Note that `positionField` is _not_ defined in the schema. In fact, it will be completely _invisible_ to the application using SimpleDbLayer: it won't be returned in `select` queries, and won't be updatable.

Imagine that you add some data:

    var tony = { id: 1, name: 'Tony', surname: 'Mobily', age: 37 };
    var chiara = { id: 2, name: 'Chiara', surname: 'Mobily', age: 23 };

    people.insert( tony, { returnRecord: true }, function( err, tony ){
      if( err ) return cb( err );

      people.insert( chiara, { returnRecord: true }, function( err, chiara ){
        if( err ) return cb( err );
        // ...

At this point, you decide to position the record with `id` 2 (chiara) _before_ the one with id `1`. Just run:

    people.reposition( chiara, 1, function( err ){

The records' `position` field on the database will be updated so that they are in the right order.

From now on, when running `select` calls _without_ any sorting options, SimpleDbLayer will return them sorted by the `position` field.

## Nested record positioning

In most cases, your records will be "nested" to other ones. Imagine these two layers:

    var people = new DbLayer( 'people', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        name: { type: 'string', required: true },
        surname: { type: 'string', searchable: true },
        age: { type: 'number', searchable: true },
      }),

      idProperty: 'id',

    } );

    var emails = new DbLayer( 'emails', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        personId: { type: 'id' },
        email: { type: 'string', required: true },
      }),

      idProperty: 'id',

    } );

Each person will have a number of emails -- all the ones with the corresponding personId. When dealing with positioning, you need to take into account what fields define the 'ordering grouping': placing an email address before another one should only ever affect the records belonging to the same person.

This is where the `positionBase` array comes in.

This is how you would make the `emails` layer able to handle positioning:

    var emails = new DbLayer( 'emails', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        personId: { type: 'id' },
        email: { type: 'string', required: true },
      }),

      idProperty: 'id',

      positionField: 'position',
      positionBase: [ 'personId' ],

    } );

The attribute `positionBase` basically decides the domain in which the reordering will happen: only records where `personId` matches the moving record's `personId` will be affected by repositioning.


# Indexing

You can create and delete indexes using SimpleDbLayer.
The methods are:

## `makeIndex( keys, name, options, cb )`

The method `makeIndex` will create an index. When calling the function:

* `keys` is an hash where each key is the field name, and each value can be `1` (ascending order) or `-1` (descending order). So, if you have `{ name: 1, surname: 1 }`, the database will be instructed to create an index with the fields `name` and `surname`, both in ascending order.
* `name` is the name of your index.
* `options` is a hash where: `{ background: true }` will start the process in background; `unique` will instruct the database that the index will need to be unique; `name` will force the index name to a specific label, rather than the database's default.

## `dropIndex( name, cb)`

This metod `dropIndex()` will drop an index.

## `dropAllIndexes()`

The method `dropAllIndexes` will drop all indexes for the table/collection.

## `generateSchemaIndexes()`

This function is used to generate indexes depending on what fields are marked as `searchable` in the schema. The implementation of this depends on the capabilities and architecture of the database server you are using. The goal is to make sure that all searches are based on indexes.

Imagine that you have a schema so defined:

    schema: new SimpleSchema({
      id: { type: 'id' },
      name: { type: 'string', required: true },
      surname: { type: 'string', searchable: true },
      age: { type: 'number' },
    }),

The only searchable field is `surname`: an index will definitely be created to statisfy it

SimpleDbLayer provides two class-level functions that affect all the layers in the registry:

### `SimpleDbLayer.generateSchemaIndexesAllLayers()`

This function does what it says: it generates all schema indexes for every layer defined in the registry.

### `SimpleDbLayer.dropAllIndexesAllLayers()`

This function drops all indexes for every layer defined in the registry.

#### A note on inherited classes.

Remember that class functions are inherited by subclasses when subclassing is done using [simpleDeclare](https://github.com/mercmobily/simpleDeclare). So, if you define your layer like this:

      // Make up the database class
      var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );

You can run `DbLayer.generateSchemaIndexesAllLayers()` as well as `SimpleDbLayer.generateSchemaIndexesAllLayers()`.

# Layer registry

When you create a layer, you define the layer's name. In this case, for example, the layer's name is 'emails':

    var emails = new DbLayer( 'emails', {

      schema: new SimpleSchema({
        id: { type: 'id' },
        personId: { type: 'id' },
        email: { type: 'string', required: true },
      }),

      idProperty: 'id',

    } );

SimpleDbLayer keeps a registry of layers, accessible through "class calls".

This mechanism is very handy when you want to define your layers in a sub-module and then want to access those variables anywhere in your program.

## DbLayer.getLayer()

The function `DbLayer.getLayer()` will return a single layer from the layer registry:

    emails = DbLayer.getLayer('emails')
    // layer is now ready to be used to insert, delete, etc. 

## DbLayer.getAllLayers()

The function `DbLayer.getAllLayers()` will return _all_ layers in the registry:

    allLayers = DbLayer.getAllLayers()
    // allLayers is now { emails: ..., people: ... }

As you can see, allLayers is a hash object where each key is the layer's name.

# Why another DB abstraction module?

This module was specificaly created to allow the [JsonRestStores](https://github.com/mercmobily/JsonRestStores) module to interact with several database engines.

Unlike other layers/ORMs, it only does what's normally required when dealing with web application data. If you are after a full-blown database abstraction module or ORM, you should look somewhere else.

# Changes

Here I will list the major changes I make to the library

## Changes from "0.3.12", "0.3.13"

* BREAKING idProperty is now mandatory, and it's forced in the schema as searchable and required
* BREAKING Schema needs to be defined, fields have searchable (boolean) and required (boolean)
* positionField and positionBase are now here
* insert and update have the skipValidation option
* constructor can be passed the validationError object, which will be created (explain how)
* There is a global layer registry, accessible as SimpleDbLayer.getLayer(), SimpleDbLayer.getAllLayers()
* [index] New index functions makeAllIndexes(), dropAllIndexes(), makeIndex()
* [index] Global index funcs SimpleDbLayer.makeAllIndexesAllLayers() and SimpleDbLayer.dropAllIndexesAllLayers()
* [index] A field can be defined as indexPrefix ( will be used as prefix), and permute (will be permuted among others defined with permute).
* [nested] It is now possible to define nested tables, for 1:n relationships and 1:1 (lookup) relationships
* [nested] { children: true } option in select()
* [nested] If using nested layers, SimpleDbLayer.initLayers() needs to be called before any db operation


