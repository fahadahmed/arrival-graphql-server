import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { gql } from 'graphql-tag';
import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKey.json' assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

export const typeDefs = gql`
  type Todo {
    id: ID!
    description: String!
    completed: Boolean!
    updatedAt: String!
  }

  type Query {
    todos(since: String): [Todo]
  }

  type Mutation {
    addTodo(description: String!): Todo
    completeTodo(id: ID!): Todo
    deleteTodo(id: ID!): Boolean
    updateTodos(todos: [TodoInput!]!): Boolean
  }

  input TodoInput {
    id: ID!
    description: String!
    completed: Boolean!
    updatedAt: String!
  }
`;

export const resolvers = {
  Query: {
    todos: async (_: any, { since }: { since?: string }) => {
      let query = db.collection('todos');
      if (since) {
        query = query.where('updatedAt', '>', Timestamp.fromDate(new Date(since)));
      }
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
  },
  Mutation: {
    addTodo: async (_: any, { description }: { description: string }) => {
      const docRef = await db.collection('todos').add({
        description,
        completed: false,
        updatedAt: new Date().toISOString(),
      });
      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() };
    },
    completeTodo: async (_: any, { id }: { id: string }) => {
      const docRef = db.collection('todos').doc(id);
      await docRef.update({ completed: true, updatedAt: new Date().toISOString() });
      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() };
    },
    deleteTodo: async (_: any, { id }: { id: string }) => {
      const docRef = db.collection('todos').doc(id);
      await docRef.delete();
      return true;
    },
    updateTodos: async (_: any, { todos }: { todos: any[] }) => {
      const batch = db.batch();
      todos.forEach(todo => {
        const docRef = db.collection('todos').doc(todo.id);
        batch.set(docRef, todo, { merge: true });
      });
      await batch.commit();
      return true;
    },
  },
};

// The ApolloServer constructor requires two parameters: your schema
// definition and your set of resolvers.
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Passing an ApolloServer instance to the `startStandaloneServer` function:
//  1. creates an Express app
//  2. installs your ApolloServer instance as middleware
//  3. prepares your app to handle incoming requests
const { url } = await startStandaloneServer(server, {
  listen: { port: 4000, path: '/graphql' },
});

console.log(`🚀  Server ready at: ${url}`);