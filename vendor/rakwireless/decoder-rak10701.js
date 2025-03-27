// Decoder for RAK10701 (RAK Wireless), 
// NOTE: Already set up to work with lorawan-listener plugin
function decodeUplink(input) {
    let bytes = input.bytes;
    let port = input.fPort;
    let decoded = {
        measurements: []
    };

    if ((port === 1) || (port === 2)) {
        let lonSign = (bytes[0] >> 7) & 0x01 ? -1 : 1;
        let latSign = (bytes[0] >> 6) & 0x01 ? -1 : 1;

        let encLat = ((bytes[0] & 0x3f) << 17) +
            (bytes[1] << 9) +
            (bytes[2] << 1) +
            (bytes[3] >> 7);

        let encLon = ((bytes[3] & 0x7f) << 16) +
            (bytes[4] << 8) +
            bytes[5];

        let hdop = bytes[8] / 10;
        let sats = bytes[9];

        let maxHdop = 2;
        let minSats = 5;

        let latitude = latSign * (encLat * 108 + 53) / 10000000;
        let longitude = lonSign * (encLon * 215 + 107) / 10000000;
        let altitude = ((bytes[6] << 8) + bytes[7]) - 1000;
        let accuracy = (hdop * 5 + 5) / 10;

        if ((hdop < maxHdop) && (sats >= minSats)) {
            // Send only acceptable quality of position to mappers
            decoded.measurements.push(
                { name: "latitude", value: latitude },
                { name: "longitude", value: longitude },
                { name: "altitude", value: altitude },
                { name: "accuracy", value: accuracy },
                { name: "hdop", value: hdop },
                { name: "sats", value: sats }
            );
        } else {
            decoded.measurements.push(
                { name: "error", value: `Need more GPS precision (hdop must be <${maxHdop} & sats must be >= ${minSats}) current hdop: ${hdop} & sats: ${sats}` },
                { name: "latitude", value: latitude },
                { name: "longitude", value: longitude },
                { name: "altitude", value: altitude },
                { name: "accuracy", value: accuracy },
                { name: "hdop", value: hdop },
                { name: "sats", value: sats }
            );
        }
    }
    return { data: decoded };
}
