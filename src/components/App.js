import React, { Component } from "react";
import { inject, observer } from "mobx-react";

import store from "../stores/Store";
import { startFirebaseApp } from "../db/FirebaseDb";
import QueryHelper from "../helpers/QueryHelper";
import Workstation from "./Workstation";
import Navbar from "./Navbar";
import Modal from "./modals/Modal";

@observer
export default class App extends Component {
  componentWillMount() {
    this.setCurrentDb(store.currentDatabase);
  }

  setCurrentDb = currentDatabase => {
    if (!currentDatabase) {
      return;
    }
    store.killListeners();
    startFirebaseApp(currentDatabase);
    store.setCurrentDatabase(currentDatabase);
    // QueryHelper.getRootKeysPromise(currentDatabase).then(rootKeys => {
    //   console.log(rootKeys)
    //   store.rootKeys = rootKeys;
    // })
  };

  updateSavedQueries = db => {
    const dbUrl = db.config.databaseURL;
    let queriesByDb = store.savedQueriesByDb;
    let savedQueries =
      !queriesByDb || !queriesByDb[url] ? null : queriesByDb[url];
    this.setState({ savedQueries });
  };

  createDb = database => {
    let err = store.createNewDatabase(database);
    if (err) {
      return err;
    }
    this.setCurrentDb(database);
    store.currentDatabase = database;
    store.modal.set(null);
  };

  startFirebaseForDb = db => {
    startFirebaseApp(db.url);
  };

  executeQuery = query => {
    store.killListeners();
    query = QueryHelper.formatAndCleanQuery(query);
    store.addQueryToHistory(query);
    store.executingQuery.set(true);
    try {
      QueryHelper.executeQuery(query, store.currentDatabase, results => {
        store.addNewListener(results.firebaseListener);
        store.executingQuery.set(false);
        // store.results = null; //updating object props alone won't work w/mobx objects, need to reset to trigger observables
        store.results.update(results);
        if (results && results.statementType != "SELECT_STATEMENT") {
          store.commitQuery.set(query);
        }
      });
    } catch (error) {
      debugger;
      store.results.update({ error });
      store.executingQuery.set(false);
    }
  };

  commit = () => {
    store.focus = true; //refocus text after commit click
    store.killListeners();
    if (!store.commitQuery.get() || !store.currentDatabase) {
      return;
    }
    const query = QueryHelper.formatAndCleanQuery(store.commitQuery.get());
    store.markQueryAsCommitted(query);
    try {
      QueryHelper.executeQuery(
        query,
        store.currentDatabase,
        results => {
          store.addNewListener(results.firebaseListener);
          store.killListeners();
          store.clearResults();
        },
        true
      );
    } catch (error) {
      debugger;
      console.log("executeQuery err: ", error);
      store.results.update({ error });
    }
  };

  cancelCommit = () => {
    store.clearResults();
  };

  render() {
    console.log("store:", store);
    const savedQueries =
      store.savedQueriesByDb && store.currentDatabase
        ? store.savedQueriesByDb[store.currentDatabase.url]
        : null;

    const props = {
      cancelCommit: this.cancelCommit,
      createDb: this.createDb,
      commit: this.commit,
      executeQuery: this.executeQuery,
      results: store.results,
      newDb: store.newDb,
      savedQueries: savedQueries,
      setCurrentDb: this.setCurrentDb,
      startFirebaseForDb: this.startFirebaseForDb,
      store: store,
      firestoreEnabled: store.firestoreEnabled.get(),
      updateSavedQueries: this.updateSavedQueries
    };

    return (
      <div className="App">
        <Navbar {...props} />
        {store.modal.get() && <Modal {...props} />}
        {store.currentDatabase && <Workstation {...props} />}
      </div>
    );
  }
}
