import React from "react";
import classnames from "classnames";
import typeName from "type-name";
import ReactTooltip from "react-tooltip";
import PropTypes from "prop-types";
import _ from "lodash";

import store from "../../stores/Store";
import StringHelper from "../../helpers/StringHelper";

import { set, deleteObject, setObjectProperty } from "../../db/UpdateDb";

export default class ObjectNode extends React.Component {
  state = {
    opened: this.props.level > 0,
    keyEdit: false
  };

  VALUE_EDIT = "FIRESTATION_RESERVED_VALUE_EDIT";

  UNSAFE_componentWillReceiveProps(newProps) {
    if (this.props.value !== newProps.value) {
      this.setState({ opened: newProps.level > 0 });
    }
  }

  toggleNode = () => {
    this.setState({ opened: !this.state.opened });
  };

  render() {
    const { value } = this.props;
    const type = typeName(value);
    return /^(Array|Object)$/.test(type)
      ? this.renderObject(value, type)
      : /^(number|string|boolean|null)$/.test(type)
      ? this.renderValue(value, type)
      : this.renderOther(value, type);
  }

  deleteConfirmation(e, path) {
    e.stopPropagation();
    const confirmationMsg =
      "warning All data at this location, including nested data, will be permanently deleted: \nData location: " +
      path;
    if (confirm(confirmationMsg)) {
      const isFirestore = (store.results || {}).isFirestore;
      deleteObject(store.currentDatabase, path, isFirestore);
    }
  }

  sortByOrderBys(resultsArr) {
    let orderBys = store.results.orderBys;
    if (!orderBys) {
      return resultsArr;
    }

    const compare = (a, b) => {
      if (!a) {
        return -1;
      } else if (!b) {
        return 1;
      }
      if (typeof a === "string" || typeof b === "string") {
        return (a + "").toLowerCase().localeCompare((b + "").toLowerCase());
      } else {
        return a - b;
      }
    };

    //earliest orderBy's takes precedence, so we'll .reverse()
    orderBys.reverse().forEach(orderBy => {
      let propToSort = orderBy.propToSort;
      resultsArr.sort((a, b) => {
        a = a.value[propToSort];
        b = b.value[propToSort];
        if (!orderBy.ascending) {
          return compare(b, a);
        } else {
          return compare(a, b);
        }
      });
    });

    return resultsArr;
  }

  renderObject(obj, type) {
    const { path, level, fbPath } = this.props;
    if (!fbPath) {
      return null;
    }
    const { opened } = this.state;
    const clevel = level > 0 ? level - 1 : 0;
    const that = this;
    let iter =
      type === "Array"
        ? obj.map((v, i) => ({ prop: i, value: v }))
        : Object.keys(obj)
            .sort(function(a, b) {
              return a.toLowerCase().localeCompare(b.toLowerCase());
            })
            .map(prop => ({ prop, value: obj[prop] }));
    if (level === 2) {
      iter = this.sortByOrderBys(iter);
    }
    return (
      <div className="object-node">
        <div className="object-label">
          {clevel !== 1 && (
            <i
              onClick={this.toggleNode}
              className={classnames("toggle-icon", { opened })}
              data-tip
              data-for={"data-collapse " + fbPath}
            />
          )}
          <ReactTooltip
            id={"data-collapse " + fbPath}
            type="dark"
            effect="solid"
            place="top"
          >
            {opened ? "Collapse Data" : "Expand Data"}
          </ReactTooltip>
          {clevel !== 1 && that.props.creationPath === fbPath && (
            <div className="new-prop">
              <div>
                <input
                  type="text"
                  placeholder="Key"
                  onChange={e => this.setState({ newKey: e.target.value })}
                />{" "}
                <br />
                <input
                  type="text"
                  placeholder="Value"
                  onChange={e => this.setState({ newVal: e.target.value })}
                />
                <br />
              </div>
              <div className="new-prop-btns">
                <button onClick={this.createNewProperty} className="bt sm">
                  Save
                </button>
                <button
                  onClick={() => this.props.setCreationPath(null)}
                  className="bt red sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {clevel !== 1 && !that.props.creationPath && (
            <span>
              <i
                onClick={() => that.props.setCreationPath(fbPath)}
                data-tip
                data-for={"add-child " + fbPath}
                className="fa fa-plus"
              />
              <ReactTooltip
                id={"add-child " + fbPath}
                type="dark"
                effect="solid"
                place="top"
              >
                Add Property
              </ReactTooltip>
              <i
                onClick={e => this.deleteConfirmation(e, fbPath)}
                data-tip
                data-for={"delete-child " + fbPath}
                className="fa fa-times"
              />
              <ReactTooltip
                id={"delete-child " + fbPath}
                type="dark"
                effect="solid"
                place="top"
              >
                Delete Object
              </ReactTooltip>
            </span>
          )}
        </div>
        <table
          style={{ display: opened ? "block" : "none" }}
          className={clevel === 1 ? "root-table" : "nested-table"}
        >
          <tbody>
            {iter.map(({ prop, value }) => {
              const cpath =
                type === "Array"
                  ? `${path}[${prop}]`
                  : path
                  ? `${path}.${prop}`
                  : prop;
              const entireFbPath =
                fbPath +
                (fbPath.charAt(fbPath.length - 1) === "/" ? "" : "/") +
                prop;
              const handleClick = () => {
                this.setState({ keyEdit: true });
                this.props.setPathUnderEdit(entireFbPath);
              };

              return (
                <tr key={prop} className="objectNode-tr">
                  {this.props.pathUnderEdit &&
                  this.props.pathUnderEdit === entireFbPath ? (
                    <th
                      className="prop-name"
                      onClick={e => {
                        e.stopPropagation();
                      }}
                    >
                      <form onSubmit={that.handleSubmit}>
                        <input
                          onChange={that.handleEditChange}
                          type="text"
                          defaultValue={prop}
                          autoFocus="autofocus"
                          className="objNode-input"
                        />
                      </form>
                      <div
                        className="onClickOutside"
                        onClick={() => this.props.setPathUnderEdit(null)}
                      />
                    </th>
                  ) : (
                    <th onClick={handleClick} className="prop-name">
                      {prop}
                    </th>
                  )}
                  {!this.props.noValue && (
                    <td className="prop-value">
                      <ObjectNode
                        value={value}
                        path={cpath}
                        fbPath={entireFbPath}
                        pathUnderEdit={this.props.pathUnderEdit}
                        setPathUnderEdit={this.props.setPathUnderEdit}
                        creationPath={this.props.creationPath}
                        setCreationPath={this.props.setCreationPath}
                        level={clevel}
                        key={prop}
                      />
                      {typeof value !== "object" && (
                        <th>
                          <i
                            data-tip
                            data-for="delete-child"
                            onClick={e =>
                              this.deleteConfirmation(e, entireFbPath)
                            }
                            className="fa fa-times delete-prop"
                            aria-hidden="true"
                          />
                          <ReactTooltip
                            id="delete-child"
                            type="dark"
                            effect="solid"
                            place="top"
                          >
                            Delete Property
                          </ReactTooltip>
                        </th>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  handleSubmit = e => {
    e.preventDefault();
    let newValue = StringHelper.getParsedValue(this.state.newVal);
    let path = this.props.fbPath;
    const pathUnderEdit = this.props.pathUnderEdit;
    const keyConfirmationMsg =
      "This will permanently move all child data.\n Data location: " +
      pathUnderEdit +
      " ---> " +
      path +
      "/" +
      newValue;

    const isFirestore = (store.results || {}).isFirestore;

    if (!this.state.keyEdit) {
      //value update
      set(store.currentDatabase, path, newValue, isFirestore);
    } else if (pathUnderEdit && confirm(keyConfirmationMsg)) {
      if (path.indexOf("/") < 0) {
        //root obj key update
        const key = pathUnderEdit.substring(pathUnderEdit.lastIndexOf("/") + 1);
        const val = this.props.value[key];
        set(store.currentDatabase, `${path}/${newValue}`, val, isFirestore);
        deleteObject(store.currentDatabase, pathUnderEdit, isFirestore);
      } else {
        //deep key update
        let newObject = _.clone(this.props.value);
        let oldKey = pathUnderEdit.substring(
          pathUnderEdit.lastIndexOf("/") + 1
        );
        newObject[newValue] = newObject[oldKey];
        delete newObject[oldKey];
        newValue = newObject;
        set(store.currentDatabase, path, newValue, isFirestore);
      }
    }

    this.setState({ newVal: null, keyEdit: false });
    this.props.setPathUnderEdit(null);
  };

  handleEditChange = e => {
    this.setState({ newVal: e.target.value });
  };

  createNewProperty = () => {
    const isFirestore = (store.results || {}).isFirestore;
    setObjectProperty(
      store.currentDatabase,
      this.props.creationPath + "/" + this.state.newKey,
      this.state.newVal,
      isFirestore
    );
    this.props.setCreationPath(null);
  };

  renderValue(value, type) {
    return (
      <div>
        {this.props.pathUnderEdit === this.props.fbPath + this.props.prop ? (
          <div className="object-node" onClick={this.stopProp}>
            <form onSubmit={this.handleSubmit}>
              <input
                onChange={this.handleEditChange}
                type="text"
                defaultValue={JSON.stringify(value)}
                autoFocus="autofocus"
                className="objNode-input"
                onClick={e => e.stopPropagation()}
              />
              <span
                className="onClickOutside"
                onClick={() => this.props.setPathUnderEdit(null)}
              />
            </form>
          </div>
        ) : (
          <div
            className="object-node editable"
            onClick={() =>
              this.props.setPathUnderEdit(this.props.fbPath + this.props.prop)
            }
          >
            <span className={classnames("object-value", type)}>
              {JSON.stringify(value)}
            </span>
          </div>
        )}
      </div>
    );
  }

  renderOther(value, type) {
    console.log(`renderOther:${type} --- ${value}`);

    return (
      <div className="object-node">
        <div className="object-label" onClick={this.toggleNode}>
          {/*<span className='object-type'>{'(' + type + ')'}</span>*/}
        </div>
      </div>
    );
  }
}

ObjectNode.propTypes = {
  value: PropTypes.any.isRequired,
  path: PropTypes.string.isRequired,
  level: PropTypes.number.isRequired,
  isFirestore: PropTypes.bool,
  pathUnderEdit: PropTypes.string,
  setPathUnderEdit: PropTypes.func,
  creationPath: PropTypes.string,
  setCreationPath: PropTypes.func,
  fbPath: PropTypes.string,
  noValue: PropTypes.bool,
  prop: PropTypes.string
};
