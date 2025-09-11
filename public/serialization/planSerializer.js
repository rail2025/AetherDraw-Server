const PlanSerializer = (function () {

    const FILE_SIGNATURE = new Uint8Array([65, 68, 80, 78]); // 'ADPN'
    const PLAN_FORMAT_VERSION = 1;

    return Object.freeze({
        serializePlanToBytes: function (allPages, planName, appVersionMajor = 1, appVersionMinor = 0, appVersionPatch = 0) {
            if (!allPages) throw new Error("allPages cannot be null.");
            
            planName = planName || "Unnamed Plan";

            try {
                const writer = new BufferHandler();

                writer.writeBytes(FILE_SIGNATURE);
                writer.writeInt32(PLAN_FORMAT_VERSION);
                writer.writeUint16(appVersionMajor);
                writer.writeUint16(appVersionMinor);
                writer.writeUint16(appVersionPatch);
                writer.writeString(planName);
                writer.writeInt32(allPages.length);

                for (const page of allPages) {
                    writer.writeString(page.name || "Unnamed Page");

                    const pageDrawablesData = DrawableSerializer.serializePageToBytes(page.drawables);
                    writer.writeInt32(pageDrawablesData.byteLength);
                    writer.writeBytes(new Uint8Array(pageDrawablesData));
                }
                
                return writer.getBuffer();
            } catch (ex) {
                console.error(`Error during plan serialization for '${planName}'.`, ex);
                return null;
            }
        },

        deserializePlanFromBytes: function (planDataBytes) {
            if (!planDataBytes || planDataBytes.byteLength < 16) {
                 console.error("Input plan data is null or too short.");
                return null;
            }

            try {
                const reader = new BufferHandler(planDataBytes);
                
                const signatureFromFile = reader.readBytes(FILE_SIGNATURE.length);
                if (signatureFromFile.some((v, i) => v !== FILE_SIGNATURE[i])) {
                    console.error("Invalid file signature. Not an AetherDraw Plan file.");
                    return null;
                }

                const fileFormatVersion = reader.readInt32();
                if (fileFormatVersion > PLAN_FORMAT_VERSION) {
                    console.error(`Unsupported plan version. File: ${fileFormatVersion}, Supported: ${PLAN_FORMAT_VERSION}.`);
                    return null;
                }

                const result = {
                    planName: "",
                    pages: [],
                    fileFormatVersionRead: fileFormatVersion,
                    programVersionMajorRead: reader.readUint16(),
                    programVersionMinorRead: reader.readUint16(),
                    programVersionPatchRead: reader.readUint16(),
                };

                result.planName = reader.readString();
                const pageCount = reader.readInt32();

                if (pageCount < 0 || pageCount > 1000) {
                    console.error(`Invalid number of pages in plan: ${pageCount}.`);
                    return null;
                }

                for (let i = 0; i < pageCount; i++) {
                    const pageName = reader.readString();
                    const pageDataLength = reader.readInt32();

                    if (pageDataLength < 0 || pageDataLength > reader.buffer.byteLength - reader.offset) {
                        console.error(`Invalid page data length for page '${pageName}'.`);
                        return null;
                    }
                    
                    const pageDrawablesData = reader.readBytes(pageDataLength).buffer;
                    const drawables = DrawableSerializer.deserializePageFromBytes(pageDrawablesData);
                    
                    result.pages.push({ name: pageName, drawables: drawables });
                }

                return result;

            } catch (ex) {
                console.error("General deserialization error.", ex);
                return null;
            }
        },
        // --- NEW FUNCTION TO SEND DELETE MESSAGES ---
        serializeGuids: function(guids) {
            const buffer = new ArrayBuffer(4 + guids.length * 16);
            const view = new DataView(buffer);
            
            view.setInt32(0, guids.length, true); // true for little-endian

            let offset = 4;
            guids.forEach(guidStr => {
                const hex = guidStr.replace(/-/g, '');
                for (let i = 0; i < 16; i++) {
                    view.setUint8(offset + i, parseInt(hex.substring(i * 2, i * 2 + 2), 16));
                }
                offset += 16;
            });

            return buffer;
        },

        // --- NEW FUNCTION TO READ DELETE MESSAGES ---
        deserializeGuids: function(dataBytes) {
            const guids = [];
            if (!dataBytes || dataBytes.byteLength < 4) return guids;

            const reader = new BufferHandler(dataBytes);
            const count = reader.readInt32();

            if (count < 0 || count > 10000) {
                console.error(`Invalid GUID count in delete payload: ${count}`);
                return guids;
            }

            for (let i = 0; i < count; i++) {
                const bytes = reader.readBytes(16);
                let hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                const uuid = `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
                guids.push(uuid);
            }

            return guids;
        }
    });

})();