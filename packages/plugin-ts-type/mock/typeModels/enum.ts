/** description */
export const ColumnTypeLabel = {
    Char: '',
    Char2: '',
    Char3: ''
};
/** pet status in the store */
export const StatusLabel = {
    Available: '',
    Pending: '',
    Sold: ''
};
/** Order Status */
export const Status1Label = {
    Placed: '',
    Approved: '',
    Delivered: ''
};

/** description */
enum ColumnType {
    Char = "CHAR",
    Char2 = "CHAR2",
    Char3 = "CHAR3"
}

/** pet status in the store */
enum Status {
    Available = "available",
    Pending = "pending",
    Sold = "sold"
}

/** Order Status */
enum Status1 {
    Placed = "placed",
    Approved = "approved",
    Delivered = "delivered"
}

/** description */
export const columnTypeOption = [{
    label: ColumnTypeLabel.Char,
    value: ColumnType.Char
}, {
    label: ColumnTypeLabel.Char2,
    value: ColumnType.Char2
}, {
    label: ColumnTypeLabel.Char3,
    value: ColumnType.Char3
}];
/** pet status in the store */
export const statusOption = [{
    label: StatusLabel.Available,
    value: Status.Available
}, {
    label: StatusLabel.Pending,
    value: Status.Pending
}, {
    label: StatusLabel.Sold,
    value: Status.Sold
}];
/** Order Status */
export const status1Option = [{
    label: Status1Label.Placed,
    value: Status1.Placed
}, {
    label: Status1Label.Approved,
    value: Status1.Approved
}, {
    label: Status1Label.Delivered,
    value: Status1.Delivered
}];
