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

* It doesn't manage connections. You will have to create a connection to the database and pass it to it
* `update` and `delete` statements don't accept `sort` and `range` (they will either affect one record, or all of them).
* It doesn't implement Models constructors and object types as many other ORMs do (mainly because SimpleDbLayer is _not_ an ORM, but a thin layer around databases).

Once again, all these features (and limitations) are tailored around the fact that SimpleDbLayer is a module that enables [JsonRestStores](https://github.com/mercmobily/JsonRestStores) to have several (thin) database layers.

# Database-specific adapters

At the moment, here is the list of database-specific adapters:

* MongoDB -- [simpledblayer-mongo](https://github.com/mercmobily/simpledblayer-mongo). In MongoDB joins are implemented with pre-caching, meaning that 1:n relations are pre-loaded in the record itself. This means very, very fast read operations and very tricky update/delete logic in the layer (cached data needs to be updated/deleted as well).
* ...more to come (now that the API is stable)

# Note: "SimpleDbLayer is not an ORM"

SimpleDbLayer is exactly what it says: a (thin) database layer. Most of the other database libraries (such as the excellent [Waterline](https://github.com/balderdashy/waterline) work in such a way that they define an "Object type" (call it a model, or constructor function) and create objects of that "type": 

    // This is NOT how SimpleDbLayer works
    var User = Waterline.Collection.extend({ name: { type: string } } );
    var user = new User();
    user.name = "tony";
    user.save();`.

This is _not_ how SimpleDbLayer works: you don't define models, custom methods for specific models, etc. SimpleDbLayer is a _thin_ layer around database data. In SimpleDbLayer, each database table is mapped to a _plain database object_:


    // ...Include module, create database connection, etc.
    var DbLayer = declare( [ SimpleDbLayer, SimpleDbLayerMongo ], { db: db } );

      var people = new DbLayer( {

        table: 'peopleDbTable',

        schema: new SimpleSchema({
          id:      { type: 'id' },
          name:    { type: 'string', required: true },
          surname: { type: 'string', searchable: true },
          age:     { type: 'number', searchable: true },
        }),

        idProperty: 'id',
      });

      people.insert( {id: '1', name: 'Tony', surname: 'Mobily', age: '39' });


The plain object `people` will have several methods (`people.update()`, `people.select()`, etc.) which will manipulate the table `peopleDbTable`. There are no types defined, and there are no "models" for that matter. Each created object will manipulate a specific table on the database, and __application-wide, there should only be one SimpleDbLayer variable created for each database table_.

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
  
** DOCUMENTATION UPDATE STOPS HERE. ANYTHING FOLLOWING THIS LINE IS 100% OUT OF DATE.**


# Running queries

## Querying: insert

To insert data into your table:

    people.insert( { id: 1, name: 'Tony', surname: 'Mobily', age: 37 }, { returnRecord: true }, function( err, record ){

The second parameter is optional. If you pass it:

* If `returnRecord` is `true`, then the callback will be called with `record` representing the record just created. Default is `false`.
* If `skipValidation` is `true`, then the validation of the data against the schema will be skipped. Default is `false`.

## Querying: update

This is a simple update:

    people.update(
      { conditions: { and: [ name: { type: 'startsWith', value: 'D' }  ] } },
      { name: 'Changed' },
      { deleteUnsetFields: true, multi: true },
      function( err, num ){

The third parameter, here set as `{ deleteUnsetFields: true, multi: true }`, is optional. If you pass it:

* If `multi` is set to `true`, all records matching the search will be updated. Otherwise, only one record will be updated.
* If `deleteUnsetFields` is set to `true`, then any field that is not defined in the update object will be set as empty in the database. Basically, it's a "full record update" regardless of what was passed. Validation will fail if a field is required by the schema and it's not set while this option is `true`.
* If `skipValidation` is true, then the schema validation of the data against the schema will be skipped. Casting will still happen.

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

SimpleDbLayer does _not_ support complex joins. However, you can define how data will be preloaded whenever you fetch a record. Note that, for speed, databases like MongoDb will actually pre-cache results for speed.

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
          type: 'multiple',
          layer: 'emails',
          join: { personId: 'id' },
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
          type: 'lookup',
          layer: 'people',          
          layerField: 'id',
          localField: 'personId'          
        }
      ],
    } );

    SimpleDbLayer.initLayers(); // <--- IMPORTANT!


***It's absolutely crucial that you run `SimpleDbLayer.initLayers()` before running queries if you have nested layers.***

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

