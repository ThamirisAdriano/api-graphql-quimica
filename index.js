const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const http = require('http');
const { gql } = require('graphql-tag');
const { PubSub } = require('graphql-subscriptions');
const { json } = require('body-parser');
const cors = require('cors'); // Importando o middleware CORS

// Dados de exemplo de usuários e atividades
const users = [
  { id: 1, username: "user1", email: "user1@example.com" },
  { id: 2, username: "user2", email: "user2@example.com" },
  { id: 3, username: "user3", email: "user2@example.com" }
];

const activities = [
  {
    id: 1,
    time: '07:00',
    type: 'Pilates',
    distance: '5',
    calories: '300',
    bpm: '120',
    user: 'user1',
    userImage: 'https://avatars.githubusercontent.com/u/68503415?s=400&u=961cb483c912c8c3a6ce63c9ed8793a79b81ac61&v=4',
    likes: 10,
    comments: 5,
    imageUrl: 'https://images.unsplash.com/photo-1522898467493-49726bf28798?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    id: 2,
    time: '08:00',
    type: 'Ciclismo',
    distance: '10',
    calories: '500',
    bpm: '110',
    user: 'user2',
    userImage: 'https://avatars.githubusercontent.com/u/68503415?s=400&u=961cb483c912c8c3a6ce63c9ed8793a79b81ac61&v=4',
    likes: 20,
    comments: 10,
    imageUrl: 'https://images.unsplash.com/photo-1480264104733-84fb0b925be3?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    id: 3,
    time: '08:00',
    type: 'Nataçãoß',
    distance: '10',
    calories: '500',
    bpm: '110',
    user: 'user2',
    userImage: 'https://avatars.githubusercontent.com/u/68503415?s=400&u=961cb483c912c8c3a6ce63c9ed8793a79b81ac61&v=4',
    likes: 20,
    comments: 10,
    imageUrl: 'https://images.unsplash.com/photo-1480264104733-84fb0b925be3?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  }
];

// Definição do esquema (schema)
const typeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
  }

  type Activity {
    id: ID!
    time: String!
    type: String!
    distance: String!
    calories: String!
    bpm: String!
    user: String!
    userImage: String!
    likes: Int!
    comments: Int!
    imageUrl: String!
  }

  type Query {
    users: [User]
    user(username: String!): User
    activities: [Activity]
    activity(id: ID!): Activity
  }

  type Mutation {
    addUser(username: String!, email: String!): User
    addActivity(
      time: String!,
      type: String!,
      distance: String!,
      calories: String!,
      bpm: String!,
      user: String!,
      userImage: String!,
      likes: Int!,
      comments: Int!,
      imageUrl: String!
    ): Activity
  }

  type Subscription {
    userAdded: User
    activityAdded: Activity
  }
`;

// Resolvers
const pubsub = new PubSub();

const resolvers = {
  Query: {
    users: () => users,
    user: (_, { username }) => users.find(user => user.username === username),
    activities: () => activities,
    activity: (_, { id }) => activities.find(activity => activity.id === parseInt(id)),
  },
  Mutation: {
    addUser: (_, { username, email }) => {
      const newUser = {
        id: users.length + 1,
        username,
        email,
      };
      users.push(newUser);
      pubsub.publish('USER_ADDED', { userAdded: newUser });
      return newUser;
    },
    addActivity: (
      _,
      { time, type, distance, calories, bpm, user, userImage, likes, comments, imageUrl }
    ) => {
      const newActivity = {
        id: activities.length + 1,
        time,
        type,
        distance,
        calories,
        bpm,
        user,
        userImage,
        likes,
        comments,
        imageUrl,
      };
      activities.push(newActivity);
      pubsub.publish('ACTIVITY_ADDED', { activityAdded: newActivity });
      return newActivity;
    },
  },
  Subscription: {
    userAdded: {
      subscribe: () => pubsub.asyncIterator(['USER_ADDED']),
    },
    activityAdded: {
      subscribe: () => pubsub.asyncIterator(['ACTIVITY_ADDED']),
    },
  },
};

// Configuração do servidor Apollo com Subscriptions
async function startApolloServer(typeDefs, resolvers) {
  const app = express();
  app.use(cors()); // Adicionando middleware CORS
  const httpServer = http.createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use('/graphql', json(), expressMiddleware(server));

  const PORT = 4000;
  httpServer.listen(PORT, () =>
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`),
  );
}

startApolloServer(typeDefs, resolvers);
