import React from "react";
import { observer } from "mobx-react";
import fs from "fs";
const { dialog, app } = require("electron").remote;

import store from "../../stores/Store";
import AddDatabase from "./AddDatabase";
import DatabaseConfig from "./DatabaseConfig";
import DownloadBackup from "./DownloadBackup";
import SaveQuery from "./SaveQuery";

const Modal = observer(({ currentDatabase, createDb, firestoreEnabled }) => {
  const serviceAccount = store.modal.get().includes("service") ? true : false;
  const modalMode = store.modal.get();

  return (
    <div className="Modal col-md-12" onClick={closeModal}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <i className="fa fa-times closeBtn" onClick={closeModal} />
        {modalMode.includes("config") && (
          <DatabaseConfig
            firestoreEnabled={firestoreEnabled}
            closeModal={closeModal}
            handleFile={handleFile}
            serviceAccount={serviceAccount}
            currentDatabase={currentDatabase}
          />
        )}
        {modalMode.includes("newDB") && (
          <AddDatabase
            createDb={createDb}
            handleFile={handleFile}
            serviceAccount={serviceAccount}
          />
        )}
        {modalMode === "saveQuery" && <SaveQuery />}
        {modalMode === "backup" && <DownloadBackup />}
      </div>
    </div>
  );
});

export default Modal;

const closeModal = () => {
  store.modal.set(null);
  store.newDb.clear();
};

const handleFile = () => {
  dialog.showOpenDialog(
    {
      defaultPath: app.getPath("downloads"),
      filters: [{ name: "json", extensions: ["json"] }]
    },
    fileNames => {
      console.log("filenames:", fileNames);
      if (fileNames === undefined) return console.log("No file selected");
      else if (fileNames.length > 1) return alert("Select only one file.");

      fs.readFile(fileNames[0], "utf-8", (err, data) => {
        if (err)
          return alert("An error ocurred reading the file :" + err.message);
        store.newDb.path = fileNames[0];
        store.newDb.data = JSON.parse(data);
      });
    }
  );
};
