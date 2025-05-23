/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('finalysisdb');

// Search for documents in the current collection.
db.getCollection('statements')
  .find(
    {
      ticker:'CF',
      statementType:'equity'
    },
    {
      /*
      * Projection
      * _id: 0, // exclude _id
      * fieldA: 1 // include field
      */
    }
  )
  .sort({
    filingDate:-1
  });
