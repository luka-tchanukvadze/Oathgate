// How many blocks have to sit on top before I treat money as mine
// A confirmation is not a second opinion, it is a price: reversing the payment
// now means rebuilding that many blocks faster than everyone else together
// One is already far more than a coffee is worth stealing, and six on a ten
// minute chain is an hour of a customer standing at a counter
//
// Settling and reversing both read this, and they have to read the same one
// At 1 here and 2 there, every payment would settle and then immediately
// reverse itself
export const MIN_CONFIRMATIONS = 1;

// What one call to the address endpoint can return
// Past this I am seeing part of the picture, and absence stops meaning gone
export const ADDRESS_TX_PAGE = 50;
