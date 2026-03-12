export const CHUNK_SIZE = 16384; // 16KB

export const sendFile = (dataChannel, file) => {
    const reader = new FileReader();
    let offset = 0;

    reader.onload = (e) => {
        dataChannel.send(e.target.result);
        offset += e.target.result.byteLength;
        if (offset < file.size) {
            readSlice(offset);
        }
    };

    const readSlice = (o) => {
        const slice = file.slice(o, o + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
    };

    readSlice(0);
};

export const receiveFile = (dataChannel, onComplete) => {
    const receivedChunks = [];
    dataChannel.onmessage = (e) => {
        receivedChunks.push(e.data);
        // This is a simplified version - in reality, we'd need a "end of file" signal
        // For now, we assume the data channel receives chunks of a single file
    };

    // Logic for completion would go here (e.g. signaling end)
};
