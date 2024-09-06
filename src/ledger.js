class LedgerJournalEntry extends JournalPageSheet {
    
  
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
  
    // You can add your own methods too
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

}
