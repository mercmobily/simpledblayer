Simpledblayer
=============

SimpleDbLayer is a module that allows you to connect and query a DB server. It was created specifically to provide a thin database layer for [JsonRestStores](https://github.com/mercmobily/JsonRestStores).

## TODO

* [X] SearchableHash -> change it to the field type, 'string', 'id', etc.
* [X] Make DB a normal parameter, rather than the constructor's third parameter
* [X] Run safeMixin on all passed parameters
* [X] take out "join" for lookup tables, since it can be inferred easily
* [ ] Rewrite new documentation <--- PLEASE NOTE THAT DOCUMENTATION IS BEING UPDATED
* [ ] Rewrite tests
* [ ] Improve range santising function

* [ ] Rewrite documentation for JsonRestStores (the basic module)
* [ ] Adapt existing software to new API (SimpleDbLayerMixin, Hotplate, BookingDojo)

* [ ] Write objectsearch function for memory, plug it in for module that mixes in with
      JsonRestStores and SimpleDbLayer (or figure out why only one or the other)

Features:

* Complex queries, with nested AND and OR statements, as well as ranges and sorting
* Full cursor support
* Schema to cast/validate fields, using [simpleschema](https://github.com/mercmobily/simpleschema).
* It allows 1-level joins in queryes and data fetching; joins are defined right in the table definition.
* The 1-level join is in the table definition because, using MongoDB, children data will be _preloaded_ and automatically updated. This means that you will be able to the record of a person, with all associated addresses, email addresses, phone numbers, etc. _in one single DB operation_.
* It is written with very simple, Object Oriented code using [simpledeclare](https://github.com/mercmobily/simpleDeclare)
* Positioning management. You can define the position of a record, which will affect the order they are returned from a query when no sorting is specified (very useful when implementing Drag&Drop in your web application)
* Semi-automatic index generation. Indexes will be created automatically as much as possible. For example, all fields marked as `searchable` will be defined as an index, as well as indexes for positioning.

Limitations:

* It doesn't manage connections. You will have to create a connection to the database and pass it to it. This is due to the module's philosophy of getting in the way as little as possible.
* `update` and `delete` statements don't accept `sort` and `range` (they will either affect one record, or all of them). This is mainly to make sure that pre-caching of children (join) tables is workable.
* It doesn't implement Models constructors and object types as many other ORMs do (mainly because SimpleDbLayer is _not_ an ORM, but a thin layer around databases).

Once again, all these features (and limitations) are tailored around the fact that SimpleDbLayer is a module that enables [JsonRestStores](https://github.com/mercmobily/JsonRestStores) to have several (thin) database layers.

# Database-specific adapters

At the moment, here is the list of database-specific adapters:

* MongoDB -- [simpledblayer-mongo](https://github.com/mercmobily/simpledblayer-mongo). In MongoDB joins are implemented with pre-caching, meaning that 1:n relations are pre-loaded in the record itself. This means very, very fast read operations and very tricky update/delete logic in the layer (cached data needs to be updated/deleted as well).
* ...more to come (now that the API is stable)

# Note: "SimpleDbLayer is not an ORM"

SimpleDbLayer is exactly what it says: a (thin) database layer. Most of the other database libraries (such as the excellent [Waterline](https://github.com/balderdashy/waterline) work in such a way that they define an "Object type" (call it a model, or constructor function) and create objects of that "type": 

    // This is NOT how SimpleDbLayer works
    var User = Waterline.Collection.extend({ name: { type: 'string' } } );
    var user = new User();
    user.name = "tony";
    user.save();`.

This is _not_ how SimpleDbLayer works: you don't define models, custom methods for specific models, etc. SimpleDbLayer is a _thin_ layer around database data. In SimpleDbLayer, each database table is mapped to a _plain database object_:


    // ...Include module, create database connection, etc.
    var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );

      var people = new DbLayer( {

        table: 'people',

        schema: new SimpleSchema({
          id:      { type: 'id' },
          name:    { type: 'string', required: true },
          surname: { type: 'string', searchable: true },
          age:     { type: 'number', searchable: true },
        }),

        idProperty: 'id',
      });

      people.insert( {id: '1', name: 'Tony', surname: 'Mobily', age: '39' });


The plain object `people` will have several methods (`people.update()`, `people.select()`, etc.) which will manipulate the table `people`. There are no types defined, and there are no "models" for that matter. Each created object will manipulate a specific table on the database, and __application-wide, there must only be one SimpleDbLayer variable created for each database table_.

When you create `people`, SimpleDbLayer keeps track of the layer created and creates an entry in its internal registry, based on the database table's name. _This means that you can only create one layer variable per table_. **Attempting to create two different layer variables for the same table will result in an error.**

# Create a DB connection

SimpleDbLayer does not handle DB connections for you. It's your responsibility to connect to the database and pass the connection object to it.
For MongoDB, you can use Mongo's connect call:

    mongo.MongoClient.connect( 'mongodb://localhost/hotplate', {}, function( err, db ){
     // db exists here
    }; 

# Make up your DB Layer class: mixins

In order to use this library, you will need to _mixin_ the basic SimpleDbLayer class and a DB-specific mixin. If you are not used to mixins, don't be scared: it's simpler than it sounds. Im simple words, requiring `simpledblayer` will return a constructor that doesn't have any of the DB-specific functions in its prototype (not in a meaningful way -- they are just stubs that throws an error). If you try to create an object using the `simpledblayer` and then run `object.select()`, `object.insert()`, etc., you will end up with an error being thrown. By _mixing in_ the constructor returned by `simpledblayer-mongo`, however, you end up with a constructor that creates fully functional objects.

    var SimpleDbLayer = require('simpledblayer'); // This is the main class
    var SimpleSchema = require('simpleschema'); // This will be used to define the schema
    var SimpleDbLayerMongo = require('simpledblayer-mongo'); // This is the layer-specific mixin

    var mongo = require('mongodb');

        // Connect to the database
    mongo.MongoClient.connect('mongodb://localhost/someDB', {}, function( err, db ){

      // DbLayer will be SimpleDbLayer "enhanced" with DB-Specific SimpleDbLayerMongo
      var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );

      // At this point, you can run `var people = new DbLayer( { ... } );

      // Documentation's code will live here

    });

**Please note:** from now on, I will assume that any code referenced in this guide will be surrounded by the code above.

THe critical line is this:

      var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );

Here you are creating a constructor function called `DbLayer`, whose prototype will be the merge of `SimpleDbLayer` (the basic functionalities), `SimpleDbLayerMongo` (the db-specific functions) and a plain object `{db: db }` (used to set the `db` attribute to the database connection)..

# Create your layer object

Once you have your DbLayer class, it's up to you to create objects which will then modify specific database tables:

      var people = new DbLayer( {

        table: 'people',

        schema: new SimpleSchema({
          id:      { type: 'id' },
          name:    { type: 'string', required: true },
          surname: { type: 'string', searchable: true },
          age:     { type: 'number', searchable: true },
        }),

        idProperty: 'id',
      });

`people` is an object tied to the collecton `people` in the MongoDb database..

The second parameter in the constructor (an object defining `table`, `schema` and `idProperty`) is a parameter object, which in this case include 1) The table name 2) The schema definition 3) The `idProperty`, which needs to be set and refer to an existing field.

Simpleschema is an constructor based on [SimpleSchema](https://github.com/mercmobily/SimpleSchema), which provides a way to define extensible schemas with a very simple API. In this case, the `name` field is required whereas `surname` and `age` are not required but are searchable.

Since the `id` field was set as `isProperty`, it will automatically be set as both `required` and `searchable`.

## Note on prototype parameters and the constructor parameter

When you actually create the object with `new`, you pass an object to the constructor: `var people = new DbLayer( { /*...this is an object with the constructor's parameters...*/ });`. 

Normally, you would define at least `table`, `schema` and `idProperty` (the required attributes every object needs to work).

Please note that you can define these attribute either in the object's prototype, or in the constructor's parameter. Every property in the constructor's parameter will be added to the created object (overriding the prototype's value).

For example, if all of your tables have `idProperty` set to `id`, you can define a layer like so:

      var DbLayerWithId = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db, idProperty: 'id' } );

Any object created with this constructor will automatically have the attribute `id` set (in the prototype):

      var people = new DbLayerWithId( {
        table: 'people',
        schema: ...
      });

      // people.idProperty is already 'id' (from the prototype)

 You can always override the prototype-provided value with something else:

     var rocks = new DbLayerWithId( {
        idProperty: 'weirdId',
        table: 'rocks',
        schema: ...
      });
      // rocks.idProperty (an object's own attribute) is 'weirdId',  

This means that you can create a constructor with the most common attributes, and only pass the absolute minimum to the constructor.

# Important object attributes

Some attributes are used by the objects to define how the object will work.
They are:

## `hardLimitOnQueries` -- Setting a hard limit on queries. Default: `0`

Cursor-less queries on large data sets will likely chew up huge amounts of memory. This is why you can set a hard limit on queries:

      var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db, hardLimitOnQueries: 10 } );

This will imply that each _non-cursor_ query will only ever return 10 items max. You can also set this limit on specific objects by passing hardLimitOnQueries as a constructor parameter:

    var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );
    var people = new DbLayer( {  /* ...layer parameters..., */ hardLimitOnQueries: 10 } );

Note that hardLimtOnQueries only ever applies to non-cursor queries.

## `SchemaError` -- Constructor function used to throw schema validation errors. Default: `Error`

The `insert` and `update` operations will trigger validation against the schema. If validation fails, the callback is called with an error. The error object is created by SimpleDbLayer like this:

    var error = new Error( { errors: errorsArray } );
    error.errors = errorsArray;

The variable `errorsArray` is an array of objects, where each object has `field` and `message` defined. For example:

    [ { field: 'age', message: 'Age is invalid' }, { field: 'name', message: 'Field is required: name' } ] 

You can set the constructor used to create the error objects by passing a `SchemaError` parameter when you define the layer:

    var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db, SchemaError: SomeErrorConstructor } );

As always, you can also define a the SchemaError constructor when creating the object with `new`:

    var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );
    var people = new DbLayer( { /* ...layer parameters..., */ SchemaError: SomeErrorConstructor } );

# Full list of options for SimpleDbLayer

Here is a full list of options that affect the behaviour of SimpleDbLayer objects. Please keep in mind that all of them can me defined either in the constructor's prototype, or as attribute of the constructor's parameter oject.

## Basic fields

* `table`. Required. No default. The table name in the underlying database.
* `schema`. Required. No default. The schema to be used.
* `idProperty`. Required. No default. The property representing the record's ID.
* `hardLimitOnQueries`. Defaults to `0` (no limit). The maximum number of objects returned by non-cursor queries.
* `SchemaError`. Defaults to `Error`. The constructor for `Error` objects.

## Advanced fields

These attributes are explained later in the documentation.

* `positionField`. Defaults to `null` (no positioning). The field used by the database engine to keep track of positioning.
* `positionBase`. Defaults to `[]`. The list of key fields which will `group` positioning
* `childrenField`. Defaults to `_children`. The attribute under which the `nested` children will be loaded into.
* `nested`. Defaults to `[]`. The 'children' tables for in-table joints.
  
# Running queries

## Querying: `insert()`

To insert data into your table:

    people.insert( { 
      id: 1,
      name: 'Tony',
      surname: 'Mobily',
      age: 37 },
      { returnRecord: true }, function( err, record ){


The second parameter is optional. If you pass it:

* If `returnRecord` is `true`, then the callback will be called with `record` representing the record just created. Default is `false`.
* If `skipValidation` is `true`, then the validation of the data against the schema will be skipped. Default is `false`.

# Querying: `update()`

This is a simple update:

    people.update(
      { name: 'startsWith', args: [ 'surname', 'mob' ] },
      { surname: 'Tobily' },
      { deleteUnsetFields: false, multi: true },
      function( err, num ){

The third parameter, here set as `{ deleteUnsetFields: false, multi: true }`, is optional. If you pass it:

* `multi`. If set to `true`, all records matching the search will be updated. Otherwise, only one record will be updated. Default: `false`.
* `deleteUnsetFields`. If set to `true`, then any field that is not defined in the update object will be set as empty in the database. Basically, it's a "full record update" regardless of what was passed. Validation will fail if a field is required by the schema and it's not set while this option is `true`. Default: `false`.
* `skipValidation`. If set to `true`, then the schema validation of the data against the schema will be skipped. Casting will still happen. Default: `false`.

Please note how the filter is an object that defines how data will be filtered. Check the `select` section to see how the filter works.

# Querying: `delete()`

This is a simple delete:

    people.delete(
      { name: 'gt', args: [ 'age', 28 ] },
      { multi: true },
      function( err, howMany ){

The second parameter, here set as `{ multi: true }`, is optional. If you pass it:

* If `multi` is set to `true`, all records matching the search will be deleted. Otherwise, only one record will be deleted. Default: `false`.

# Querying: `select()`

SimpleDbLayer supports both normal and cursor-based queries, depending on the `useCursor` parameter.

## Normal queries

For normal queries:

    people.select(
      {},
      { useCursor: false , delete: false, skipHardLimitOnQueries: false },
      function( err, data, total, grandTotal ){

The first parameter is an object representing the query (more about this later).
The second parameter is optional. If you pass it:

* `useCursor`. If set to `true`, the function will call the call the callback with a cursor rahter than the data. Default: `false`.
* `delete`. If set to `true`, SimpleDbLayer will _delete_ any fetched record. For normal queries, it will delete all records _before_ calling your callback.
* `skipHardLimitOnQueries`. If set to `true`, SimpleDbLayer will ignore the `hardLimitOnQuery` attribute and will return _all_ fetched data. flag. Remember that if you have a very large data set and do not impose any range limits, non-cursor queries will attempt to place the whole thing in memory and will probably kill your server. Default: `false.`.

The callback is called with parameter `data` (the returned records), `total` (the number of records returned) and `grandTotal` (the _total_ number of records that satisfy the query without taking into consideration the required ranges).

## Cursor queries

For cursor queries:

    people.select(
      {},
      { useCursor: true , delete: false },
      function( err, cursor, total, grandTotal ){

The second parameter is optional. If you pass it:

* `useCursor`. If set to `true`, the function will call the call the callback with a cursor rather than the data. Default: `false`.
* `delete`. If set to `true`, SimpleDbLayer will _delete_ any fetched record. For cursor queries, it will delete records as they are fetched with `cursor.next()`. Default: `false`.

Note that for cursor queries `skipHardLimitOnQueries` will be ignored.

The callback is called with parameter `cursor` (the returned cursor), `total` (the number of records returned) and `grandTotal` (the _total_ number of records that satisfy the query without taking into consideration the required ranges).

The `cursor` object has the methods `next()` and `rewind()`. `next()` will call the passed callback with the next available record, or `null` for the last fetched record. `rewind()` will bring the cursor back to the beginning of the returned dataset.

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

## Filtering

The first parameter in select, which up to this point in the documentation was was left as an empty object, is an object with the following parameters:

* `conditions`. It's an object including the attribute `name` (a string representing the name of the conditional operation to perform) and `args` (an array containing the parameters to the operation). For example, `{ name: 'startsWith', args: [ 'surname', 'mob' ] },` will filter all record where the field `surname` starts with `mob`.
* `ranges`. It's an object that can have the attributes `from`, `to` and `limit` set. All attributes are optional. For example `{ limit: 10 }`.
* `sort`. It's an object where each key represents the field the sort will apply to. For each key, value can be `-1` (bigger to smaller)  or `1` (smaller to bigger).

All parameters are optional.

Note that while the parameter passed to `select()` includes `conditions` `ranges`, `sort`, the first parameter passed to `update()` and `delete()` is only passed the `conditions` object. This means that update and delete queries will either affect _all_ records (`multi` is `true`), or _one_ record (`multi` is `false` or not passed).

A possible filtering parameter could be:

    var searchFilter = {   
      ranges: {
        from: 3,
        to: 10
      },
      sort: {
        name: -1,
        age: 1
      }
      conditions: {
        name: 'and',
        args: [
          {
            name: 'startsWith',
            args: [ 'name', 'to' ]
          },
          {
            name: 'gt',
            args: [ 'age', 30 ]
          },
        ]
      }
    }

    people.select( searchFilter, function( err, cursor, total, grandTotal ){
      // ...
    });


### The `conditions` object

The conditions object can have the following conditional operators (in `name`):

* `and` -- all conditions in `args` need to be true
* `or` -- at least one condition in `arts` needs to be true

And the following logical operators (where the value of the field called `args[0]` will need to match `args[1]`):

* `lt` -- less than
* `lte` -- less or equal than
* `gt` -- greater than
* `gte` -- greater or equal than
* `eq` -- equal to
* `contains` -- string contains
* `startsWith` -- string starts with
* `endsWith` -- string ends with

An example could be:

    {
      name: 'and',
      args: [
        {
          name: 'startsWith',
          args: [ 'name', 'to' ]
        },

        { 
          name: 'or',
          args: [
            {
              name: 'gt',
              args: [ 'age', 30 ]
            },            
            {
              name: 'lt',
              args: [ 'age', 10 ]
            },
          ]
        }
      ]
    }

Which means `name startsWith 'to' AND ( age > 30 OR age < 10 )`.



# Automatic loading of children (joins)

It is common, in application, to need to load a user's information as well as all several pieces of information related to him or her: all email addresses, all phone numbers, etc.

While SimpleDbLayer doesn't suppose joining of tables at query time, it does support joining of tables ad _table definition_ time. This means that you can define how two tables are related before hand.

The main aim of this mechanism is to allow pre-caching of data whenever possible. So, if you have a table `people` and a table `emails`, and they are have a 1:n relationship (that is, the `emails` table contains a `personId` field which will make each record related to a specific person), every time you load a record from `people` you will also automatically load all of his or her email addresses. DB-specific functions will do their best to pre-cache results. This means that, if you are using MongoDB, you can fetch a person's record as well as _any_ information associated with it (email addresses, addresses, phone numbers, etc.) **in a single read**.

## Define nested layers

You can now define a layer as "child" of another one:

    var people = new DbLayer({

      table: 'people',

      schema: new SimpleSchema({
        id     : { type: 'id' },
        name   : { type: 'string', required: true },
        surname: { type: 'string', searchable: true },
        age    : { type: 'number', searchable: true },
      }),

      idProperty: 'id',

      nested: [
        {
          type: 'multiple',
          layer: 'emails',
          join: { personId: 'id' },
        },
      ]

    } );

    var emails = new DbLayer({

      table: 'emails',

      schema: new SimpleSchema({
        id      : { type: 'id' },
        personId: { type: 'id' },
        address : { type: 'string', required: true },
      }),

      idProperty: 'id',

      nested: [
        {
          type: 'lookup',
          layer: people,          
          layerField: 'id',
          localField: 'personId'          
        }
      ],
    } );

    SimpleDbLayer.initLayers( DbLayer ); // <--- IMPORTANT!

**It's absolutely crucial that you run `SimpleDbLayer.initLayers()` before running queries if you have nested layers.** 

If you see carefully, when defining `people` I wrote:

    var people = new DbLayer({

      table: 'people',
      // ...
      nested: [
        {
          type: 'multiple',
          layer: 'emails', // <-- note: this is a string! Will do a lookup based on the table
          join: { personId: 'id' },
        },
      ]

A layer is a simple Javascript object linked to a specific table. However, when defining the layer `people`, the layer `emails` isn't defined yet -- and yet, you might need to reference it while creating relationships between layers (like in this case: a person has multiple email addresses, but `emails` hasn't been created yet.

The solution is to pass the string `'email'` for the layer property. When you run `SimpleDbLayer.initLayers()`, SimpleDbLayer will go through every `nested` option of every defined layer thanks to the registry, and will also work to 'resolve' the string (based on the table name: in this case, `emails`).



# **DOCUMENTATION UPDATE STOPS HERE. ANYTHING FOLLOWING THIS LINE IS 100% OUT OF DATE.**


As you can see, each layer is created with an extra `nested` parameter, which defines:

* `layer`. The layer you want to automatically load records from
* `type`. How you want to load your records. If you use `multiple`, SimpleDbLayer will auto-load all children records; with `lookup`, it will only load one record
* `join`. How the record will be looked up in the parent table. It's a hash object, where the key is the field _foreign_ to the layer that is being defined, and the value is the field _local_ to the layer that is being defined.
* `localField`. Only required when `type` is `lookup`, this is the name of the field in the `local` layer that is being defined that will be used.

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

