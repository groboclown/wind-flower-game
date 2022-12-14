// The global, singleton redux store
import { configureStore } from '@reduxjs/toolkit'
import {
  gameBoardReducer,
  clientPlayerReducer,
  gameLobbyReducer,
  gameplayInterfaceReducer,
} from './state'

export const store = configureStore({
  reducer: {
    gameBoard: gameBoardReducer,
    clientPlayer: clientPlayerReducer,
    gameLobby: gameLobbyReducer,
    gameplayInterface: gameplayInterfaceReducer,
  },
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch
