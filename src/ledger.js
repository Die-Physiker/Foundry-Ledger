class LedgerJournalEntry extends JournalSheet {
    
  
    constructor(data, options) {
        super(data, options);
      
    }

    // Override any method from JournalEntry here
    // For example:

    // Override the prepareData method from JournalEntry
    prepareData() {
        super.prepareData();

        // Your custom logic here
    }
  
/**
   * Get all records from the associated ledger of a property. Currently the only
   * ledger that the container actor supports is the wealth ledger, however the
   * actor data model does have hit points listed as a ledger so we will
   * leave this as is.
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Array} - Each element is a tuple: [value, reason], or null if not found
   */
  listRecords(prop) {
    if (prop === "wealth") {
      return foundry.utils.getProperty(this.system, `${prop}.transactions`);
    }
    return null;
  }

  /**
   * Return whether a property in actor data is a ledgerProperty. This means it has
   * two (sub-)properties, "value", and "transactions".
   *
   * XXX: This method is copied from cpr-actor.js because CPRContainerActor does not inherit
   *      from that class. We could fix that, but then all other code in this file would be added
   *      to an already long file. If you make changes here, be sure to consider them there too.
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Boolean}
   */
  isLedgerProperty(prop) {
    const ledgerData = foundry.utils.getProperty(this.system, prop);
    if (!foundry.utils.hasProperty(ledgerData, "value")) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Format("CPR.ledger.errorMessage.missingValue", { prop })
      );
      return false;
    }
    if (!foundry.utils.hasProperty(ledgerData, "transactions")) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Format("CPR.ledger.errorMessage.missingTransactions", {
          prop,
        })
      );
      return false;
    }
    return true;
  }

  /**
   * Change the value of a property and store a record of the change in the corresponding
   * ledger.
   *
   * @param {Number} value - how much to increase or decrease the value by
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  recordTransaction(value, reason, seller = null) {
    // update "value"; it may be negative
    // If Containers ever get Active Effects, this code will be a problem. See Issue #583.
    const cprData = foundry.utils.duplicate(this.system);
    let newValue = foundry.utils.getProperty(cprData, "wealth.value") || 0;
    let transactionSentence;
    let transactionType = "set";

    if (seller) {
      if (seller._id === this._id) {
        transactionType = "add";
      } else {
        transactionType = "subtract";
      }
    } else {
      // eslint-disable-next-line prefer-destructuring
      transactionType = reason.split(" ")[2];
    }

    switch (transactionType) {
      case "set": {
        newValue = value;
        transactionSentence = "CPR.ledger.setSentence";
        break;
      }
      case "add": {
        newValue += value;
        transactionSentence = "CPR.ledger.increaseSentence";
        break;
      }
      case "subtract": {
        newValue -= value;
        transactionSentence = "CPR.ledger.decreaseSentence";
        break;
      }
      default:
    }

    foundry.utils.setProperty(cprData, "wealth.value", newValue);
    // update the ledger with the change
    const ledger = foundry.utils.getProperty(cprData, "wealth.transactions");
    ledger.push([
      SystemUtils.Format(transactionSentence, {
        property: "wealth",
        amount: value,
        total: newValue,
      }),
      reason,
    ]);
    foundry.utils.setProperty(cprData, "wealth.transactions", ledger);
    // update the actor and return the modified property
    this.update({ system: cprData });
    return foundry.utils.getProperty(this.system, "wealth");
  }

  /**
   * Given a property name on the actor model, wipe out all records in the corresponding ledger
   * for it. Effectively this sets it back to [].
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Array} - empty or null if the property was not found
   */
  clearLedger(prop) {
    if (this.isLedgerProperty(prop)) {
      const valProp = `system.${prop}.value`;
      const ledgerProp = `system.${prop}.transactions`;
      this.update({
        [valProp]: 0,
        [ledgerProp]: [],
      });
      return foundry.utils.getProperty(this.system, prop);
    }
    return null;
  }

  /**
   * Change the value of a property and store a record of the change in the corresponding
   * ledger.
   *
   * @param {String} prop - name of the property that has a ledger
   * @param {Number} value - how much to increase or decrease the value by
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  deltaLedgerProperty(prop, value, reason) {
    if (this.isLedgerProperty(prop)) {
      // update "value"; it may be negative
      const valProp = `system.${prop}.value`;
      let newValue = foundry.utils.getProperty(this, valProp);
      newValue += value;
      // update the ledger with the change
      const ledgerProp = `system.${prop}.transactions`;
      const ledger = foundry.utils.getProperty(this, ledgerProp);
      if (value > 0) {
        ledger.push([
          SystemUtils.Format("CPR.ledger.increaseSentence", {
            property: prop,
            amount: value,
            total: newValue,
          }),
          reason,
        ]);
      } else {
        ledger.push([
          SystemUtils.Format("CPR.ledger.decreaseSentence", {
            property: prop,
            amount: -1 * value,
            total: newValue,
          }),
          reason,
        ]);
      }
      // update the actor and return the modified property
      this.update({
        [valProp]: newValue,
        [ledgerProp]: ledger,
      });
      return foundry.utils.getProperty(this.system, prop);
    }
    return null;
  }

  /**
   * Set the value of a property and store a record of the change in the corresponding
   * ledger. This is different from applying a delta, here we just set the value.
   *
   * @param {String} prop - name of the property that has a ledger
   * @param {Number} value - what to set the value to
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  setLedgerProperty(prop, value, reason) {
    if (this.isLedgerProperty(prop)) {
      const valProp = `system.${prop}.value`;
      const ledgerProp = `system.${prop}.transactions`;
      const ledger = foundry.utils.getProperty(this, ledgerProp);
      ledger.push([
        SystemUtils.Format("CPR.ledger.setSentence", {
          property: prop,
          total: value,
        }),
        reason,
      ]);
      this.update({
        [valProp]: value,
        [ledgerProp]: ledger,
      });
      return foundry.utils.getProperty(this.system, prop);
    }
    return null;
  }

}


import SystemUtils from "../utils/cpr-systemUtils.js";
export default class LedgerEditPrompt {
  static async RenderPrompt(title) {
    LOGGER.trace("RenderPrompt | LedgerEditPrompt | called.");
    return new Promise((resolve, reject) => {
      renderTemplate(
        `systems/${game.system.id}/templates/dialog/cpr-ledger-edit-prompt.hbs`
      ).then((html) => {
        const _onCancel = () => {
          LOGGER.trace("_onCancel | Dialog LedgerEditPrompt | called.");
          reject(new Error("Promise rejected: Window Closed"));
        };
        // eslint-disable-next-line no-shadow
        const _onConfirm = (html) => {
          LOGGER.trace("_onConfirm | Dialog LedgerEditPrompt | called.");
          const fd = new FormDataExtended(html.find("form")[0]);
          const formData = foundry.utils.expandObject(fd.object);
          resolve(formData);
        };
        new Dialog({
          title: SystemUtils.Localize(title),
          content: html,
          buttons: {
            confirm: {
              icon: '<i class="fas fa-check"></i>',
              label: SystemUtils.Localize("CPR.dialog.common.confirm"),
              // eslint-disable-next-line no-shadow
              callback: (html) => _onConfirm(html),
            },
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: SystemUtils.Localize("CPR.dialog.common.cancel"),
              callback: () => _onCancel(html),
            },
          },
          default: "confirm",
          render: LOGGER.trace("confirm | Dialog LedgerEditPrompt | called."),
          close: () => {
            reject(new Error("Promise rejected: Window Closed"));
          },
        }).render(true);
      });
    });
  }
}



