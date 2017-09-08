var glob = require('glob')
var util = require('util')
var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

var middleware = module.exports = options => {
    mongoose = options.mongoose ? options.mongoose : mongoose

    //mode: model
    var db = mongoose.connection
    middleware.models = {}
    middleware.dbs = {}
    if (options.schemas) {
        //mode: schema
        db = mongoose.createConnection()
        options.schemas.forEach(schema => {
          const { name } = schema;
          middleware.models[name] = db.model(name, schema)
        })
    }

    middleware.open(db, options)
    return  async (ctx, next) => {
        var database = typeof options.database === 'function' ? options.database(ctx) : options.database

        if (!middleware.dbs.hasOwnProperty(database)) {
            middleware.dbs[database] = db.useDb(database)
        }
        ctx.model = model => {
            try {
                return middleware.model(database, model)
            } catch(err) {
                ctx.throw(400, err.message)
            }
        }
        ctx.document = (model, document) => new (ctx.model(model))(document)
        await next()
    }
}

middleware.model = (database, model) => {
    var name = model.toLowerCase()
    if (!middleware.models.hasOwnProperty(name)) {
        throw new Error(util.format('Model not found: %s.%s', database, model))
    }
    return middleware.dbs[database].model(model, middleware.models[name].schema)
}

middleware.document = (database, model, document) => new (middleware.model(database, model))(document)

middleware.mongoose = mongoose

middleware.open = (db, options) => {
    if (!options || !options.host || !options.port) {
        throw new Error('options not found')
    }

    var database = typeof options.database === 'function' ? undefined : options.database

    db.on('error', err => {
        db.close();
    });

    db.open(options.host, database, options.port, options)

    return db
}

middleware.NamedSchema = (name, ...args) => {
  const schema = mongoose.Schema(...args);
  schema.name = name;
  return schema;
}
