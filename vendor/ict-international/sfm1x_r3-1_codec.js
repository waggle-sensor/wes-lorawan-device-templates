/* SFM1x R3-1 Reduced Packet Decoder Base to be used with lorawan listener plugin
	Includes Base Diagnostic and Switchable Result Packet.
	Suits SFM1x LoRa UCMI Firmware Revision r1-0-16 and newer all regions.
	Port1 Data containing Sap Flow uncorrected and Battery Voltage is maximum of 10-byte payload.
	Port10 Diagnostic Payload directly following OTAA Join is a maximum of 4-bytes.
*/

// Structure Type Define, "nested" or "flat"
var TYPE = 'nested';

/*Class Buffer
	Purpose: A psuedo buffer class for accessing packet data,
		allows for uniformity between decoder types
*/
function Buf(buf) {
  this.pl = buf;
  this.length = this.pl.length;
}
Buf.prototype.readUInt8 = function (ofs) {
  return (this.pl[ofs] << 24) >>> 24;
};
Buf.prototype.readUInt16BE = function (ofs) {
  return ((this.pl[ofs++] << 24) | (this.pl[ofs++] << 16)) >>> 16;
};
Buf.prototype.readUInt32BE = function (ofs) {
  return ((this.pl[ofs++] << 24) | (this.pl[ofs++] << 16) | (this.pl[ofs++] << 8) | this.pl[ofs++]) >>> 0;
};
Buf.prototype.readUInt16LE = function (ofs) {
  return ((this.pl[ofs + 1] << 24) | (this.pl[ofs--] << 16)) >>> 16;
};
Buf.prototype.readUInt32LE = function (ofs) {
  return ((this.pl[ofs + 3] << 24) | (this.pl[ofs + 2] << 16) | (this.pl[ofs + 1] << 8) | this.pl[ofs]) >>> 0;
};
Buf.prototype.readInt8 = function (ofs) {
  return (this.pl[ofs] << 24) >> 24;
};
Buf.prototype.readInt16BE = function (ofs) {
  return ((this.pl[ofs++] << 24) | (this.pl[ofs++] << 16)) >> 16;
};
Buf.prototype.readInt32BE = function (ofs) {
  return ((this.pl[ofs++] << 24) | (this.pl[ofs++] << 16) | (this.pl[ofs++] << 8) | this.pl[ofs++]) >> 0;
};
Buf.prototype.readInt16LE = function (ofs) {
  return ((this.pl[ofs + 1] << 24) | (this.pl[ofs--] << 16)) >> 16;
};
Buf.prototype.readInt32LE = function (ofs) {
  return ((this.pl[ofs + 3] << 24) | (this.pl[ofs + 2] << 16) | (this.pl[ofs + 1] << 8) | this.pl[ofs]) >> 0;
};
Buf.prototype.readFloatBE = function (ofs) {
  return B2Fl(this.readUInt32BE(ofs));
};
Buf.prototype.readFloatLE = function (ofs) {
  return B2Fl(this.readUInt32LE(ofs));
};
Buf.prototype.slice = function (s, e) {
  return this.pl.slice(s, e);
};
Buf.prototype.length = function () {
  return this.pl.length;
};

/*Function Bytes2Float32(bytes)
	Purpose: Decodes an array of bytes(len 4(32 bit) into a float.
	Args:	bytes - an array of bytes, 4 bytes long
	Returns: 32bit Float representation
*/
function B2Fl(b) {
  var sign = b >> 31 ? -1 : 1;
  var exp = ((b >> 23) & 0xff) - 127;
  var sig = b & ~(-1 << 23);
  if (exp == 128) return sign * (sig ? Number.NaN : Number.POSITIVE_INFINITY);
  if (exp == -127) {
    if (sig === 0) return sign * 0.0;
    exp = -126;
    sig /= 1 << 22;
  } else sig = (sig | (1 << 23)) / (1 << 23);
  return sign * sig * Math.pow(2, exp);
}

/*Function buildNested(a) - SAGE version
	Purpose: Takes an array and parses them into a clean and succinct object of nested parameter sets
	Args: a - An array of arrays containing Parameter Sets
	Returns: An Object containing nested Parameter Sets
*/
function buildNested(a) {
  var exc = ['main', 'diagnostic', 'downlink', 'device_info', 'unknown'];
  var ret = [];
  for (var el in a) {
    var e = a[el];
    var par = {};
    par['name'] = e[0];
    par['channelId'] = e[1];
    par['value'] = e[2];
    var e_length = e.length;
    if (e_length > 3 && exc.indexOf(e[3]) < 0) par['source'] = e[3];
    if (e_length > 4) par['unit'] = e[4];
    if (e_length > 5) par['address'] = e[5];
    ret.push(par);
  }
  return ret;
}

/*Function buildFlat(a)
	Purpose: Takes an array and parses them into a clean and succinct object of flat parameters
	Args: a - An array of arrays containing Parameter Sets
	Returns: An Object containing nested Parameter Sets
*/
function buildFlat(a) {
  var exc = ['main', 'diagnostic', 'downlink', 'device_info', 'unknown'];
  var ret = {};
  for (var el in a) {
    var e = a[el];
    var label = '';
    if (e.length == 6) {
      e[0] = e[0] + e[5] + '_';
    }
    if (e.length <= 4) {
      label = exc.indexOf(e[3]) < 0 ? e[0] + e[1] : e[0];
    } else {
      label = exc.indexOf(e[3]) < 0 ? e[0] + e[1] + '_' + e[4] : e[0] + '_' + e[4];
    }
    ret[label] = e[2];
  }
  return ret;
}

//Function - Decode, Wraps the primary decoder function for Chirpstack - SAGE version
function decodeUplink(input) {
  var buf = new Buf(input.bytes);
  var decoded = {};
  var readingsArr = primaryDecoder(buf, input.fPort);
  if (TYPE == 'flat') {
    decoded['measurements'] = buildFlat(readingsArr);
  } else decoded['measurements'] = buildNested(readingsArr);

  return { data: decoded };
}

/*Function primaryDecoder
	Purpose: Main Entry point of TTN Console Decoder
	Args:	bytes - An array of bytes from LoRaWan raw payload(Hex Represented)
			port - LoRaWan Port that the message came through(set by Definium firmware)
	Returns: decoded - An object with data fields as decoded parameter values
*/
function primaryDecoder(buf, p) {
  var arr = [];
  var byte = 0;

  //Data Packet Recieved
  if (p == 1) {
    var src = 'main';
    arr.push(['packet-type', 0, 'DATA_PACKET', src]);
    arr.push(['uncorrected-outer', 0, +buf.readFloatLE(byte).toFixed(3), src, 'cm/hr']);
    arr.push(['uncorrected-inner', 0, +buf.readFloatLE((byte = byte + 4)).toFixed(3), src, 'cm/hr']);
    arr.push(['battery-voltage', 0, +(buf.readUInt16LE((byte = byte + 4)) / 100).toFixed(2), src, 'V']);
  } else if (p == 10) {
    var src = 'device_info';
    arr.push(['packet-type', 0, 'DEVICE_INFO', 'main']);

    var fw_main = buf.readInt16LE(byte).toString();
    fw_main = 'R' + fw_main[0] + '-' + fw_main.slice(1, 3).replace(/^(0)?/, '') + '-' + fw_main.slice(3, fw_main.length).replace(/^(0)?/, '');
    arr.push(['firmware-mainboard', 0, fw_main, src]);

    var fw_ucmi = buf.readInt16LE((byte = byte + 2)).toString();
    //var region = ['a','e','c','s','u'];
    var region = ['a', 'c', 'e', 'i', 's', 'u'];
    var ucmi_reg = region[+fw_ucmi[fw_ucmi.length - 1]];
    //fw_ucmi =  ('R'+fw_ucmi[0]+'-'+fw_ucmi[1]+'-'+fw_ucmi.slice(2,4).replace(/^(0)?/, '')+ucmi_reg);
    fw_ucmi = 'R' + fw_ucmi[0] + '-' + fw_ucmi[1] + '-' + fw_ucmi.slice(2, 4) + ucmi_reg;
    arr.push(['firmware-ucmi', 0, fw_ucmi, src]);
  } else if (p === 100) {
    //Downlink Response Packet Recieved
    arr.push(['packet-type', 0, 'DOWNLINK_RESPONSE', 'main']);
    arr.push(['downlink-response', 0, String.fromCharCode.apply(String, buf.slice(0, buf.length)), 'downlink']);
  } else {
    // Unknown Response Recieved
    arr.push(['packet-type', 0, 'UNKNOWN_RESPONSE', 'main']);
    arr.push(['raw-payload', 0, buf.slice(0, buf.length), 'unknown']);
  }

  return arr;
}
