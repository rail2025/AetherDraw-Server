const MessageType = Object.freeze({
    STATE_UPDATE: 0,
    ROOM_CLOSING_IMMINENTLY: 1,
});

const PayloadActionType = Object.freeze({
    AddObjects: 0,
    DeleteObjects: 1,
    UpdateObjects: 2,
    ClearPage: 3,
    ReplacePage: 4,
});