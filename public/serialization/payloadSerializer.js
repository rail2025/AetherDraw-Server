const PayloadSerializer = (function () {

    return Object.freeze({
        serialize: function (payload) {
            if (!payload) throw new Error("payload cannot be null.");

            const writer = new BufferHandler();

            writer.writeInt32(payload.pageIndex);
            writer.writeUint8(payload.action);

            if (payload.data && payload.data.byteLength > 0) {
                writer.writeInt32(payload.data.byteLength);
                writer.writeBytes(new Uint8Array(payload.data));
            } else {
                writer.writeInt32(0);
            }

            return writer.getBuffer();
        },

        deserialize: function (data) {
            if (!data || data.byteLength === 0) return null;

            try {
                const reader = new BufferHandler(data);
                
                const pageIndex = reader.readInt32();
                const action = reader.readUint8();
                const dataLength = reader.readInt32();
                
                let payloadData = null;
                if (dataLength > 0) {
                    payloadData = reader.readBytes(dataLength).buffer;
                }

                return {
                    pageIndex: pageIndex,
                    action: action,
                    data: payloadData,
                };
            } catch (ex) {
                console.error("Failed to deserialize NetworkPayload.", ex);
                return null;
            }
        }
    });
    
})();