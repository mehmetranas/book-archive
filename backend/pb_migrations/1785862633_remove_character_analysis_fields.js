/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // global_books
  const globalBooks = app.findCollectionByNameOrId("pbc_1501959383")
  globalBooks.fields.removeById("json3624366373") // character_map
  globalBooks.fields.removeById("select2333209256") // character_analysis_status
  app.save(globalBooks)

  // global_movies
  const globalMovies = app.findCollectionByNameOrId("pbc_3233531153")
  globalMovies.fields.removeById("json3624366373") // character_map
  globalMovies.fields.removeById("select2382890918") // character_map_status
  app.save(globalMovies)

  // books
  const books = app.findCollectionByNameOrId("pbc_2170393721")
  books.fields.removeById("select2333209256") // character_analysis_status
  books.fields.removeById("relation3624366373") // character_map
  return app.save(books)
}, (app) => {
  // global_books
  const globalBooks = app.findCollectionByNameOrId("pbc_1501959383")
  globalBooks.fields.add(new Field({
    "help": "",
    "hidden": false,
    "id": "json3624366373",
    "maxSize": 0,
    "name": "character_map",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))
  globalBooks.fields.add(new Field({
    "help": "",
    "hidden": false,
    "id": "select2333209256",
    "maxSelect": 1,
    "name": "character_analysis_status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "none",
      "pending",
      "processing",
      "completed",
      "failed"
    ]
  }))
  app.save(globalBooks)

  // global_movies
  const globalMovies = app.findCollectionByNameOrId("pbc_3233531153")
  globalMovies.fields.add(new Field({
    "help": "",
    "hidden": false,
    "id": "json3624366373",
    "maxSize": 0,
    "name": "character_map",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))
  globalMovies.fields.add(new Field({
    "help": "",
    "hidden": false,
    "id": "select2382890918",
    "maxSelect": 1,
    "name": "character_map_status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "none",
      "pending",
      "processing",
      "completed",
      "failed"
    ]
  }))
  app.save(globalMovies)

  // books
  const books = app.findCollectionByNameOrId("pbc_2170393721")
  books.fields.add(new Field({
    "help": "",
    "hidden": false,
    "id": "select2333209256",
    "maxSelect": 1,
    "name": "character_analysis_status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "none",
      "pending",
      "processing",
      "completed",
      "failed"
    ]
  }))
  books.fields.add(new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1501959383",
    "help": "",
    "hidden": false,
    "id": "relation3624366373",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "character_map",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))
  return app.save(books)
})
