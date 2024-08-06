import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { gql } from 'graphql-tag';
import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

export const typeDefs = gql `
  type Todo {
    id: ID!
    description: String!
    completed: Boolean!
  }

  type Query {
    todos: [Todo]
    todo(id: ID!): Todo
  }

  type Mutation {
    addTodo(description: String!): Todo
    completeTodo(id: ID!): Todo
    deleteTodo(id: ID!): Boolean
  }
`;

export const resolvers = {
    Query: {
        todos: async () => {
            const snapshot = await db.collection('todos').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        todo: async (_, { id }) => {
            const doc = await db.collection('todos').doc(id).get();
            if (!doc.exists)
                throw new Error('Todo not found');
            return { id: doc.id, ...doc.data() };
        },
    },
    Mutation: {
        addTodo: async (_, { description }) => {
            const docRef = await db.collection('todos').add({ description, completed: false });
            const doc = await docRef.get();
            return { id: doc.id, ...doc.data() };
        },
        completeTodo: async (_, { id }) => {
            const docRef = db.collection('todos').doc(id);
            const doc = await docRef.get();
            if (!doc.exists)
                throw new Error('Todo not found');
            const completed = !doc.data().completed;
            await docRef.update({ completed });
            return { id: doc.id, ...doc.data(), completed };
        },
        deleteTodo: async (_, { id }) => {
            const docRef = db.collection('todos').doc(id);
            const doc = await docRef.get();
            if (!doc.exists)
                throw new Error('Todo not found');
            await docRef.delete();
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