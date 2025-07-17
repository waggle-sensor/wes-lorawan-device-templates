function decodeUplink(input) {
  const bytes = input.bytes;
  const decoded = {
    measurements: []
  };

  let i = 0;
  while (i < bytes.length) {
    const channelId = bytes[i++];
    const type = bytes[i++];

    // Analog input (type 0x02)
    if (type === 0x02) {
      const rawValue = (bytes[i] << 8) | bytes[i + 1];
      i += 2;

      // Convert to signed 16-bit integer
      const signedValue = rawValue > 0x7FFF ? rawValue - 0x10000 : rawValue;
      const finalValue = signedValue / 100;

      let name;
      if (channelId === 0x01) {
        name = "soil_moist";
      } else if (channelId === 0x02) {
        name = "soil_temp";
      } else {
        name = `AIN_${channelId}`;
      }

      decoded.measurements.push({
        name: name,
        value: finalValue
      });
    } else {
      break; // stop decoding on unknown type
    }
  }
  return { data: decoded };
}
