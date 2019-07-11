(function() {
    var config = {
        url: "https://nisak.123u.com:5000",
        version: "1.0",
        channel: "mine",
        heartTime: 5000,
    }
    window.net = exports;
    exports.config = config;
    exports.time = require("proto").ServerTime.create();
    exports.login_id = 0;
    var now = function(){
        return new Date() / 1000;
    }
    var genGetUrl= function(url){
        url += "?";
        for(var i = 1; i < arguments.length; i++) {
            var args = arguments[i]
            for(var k in args){
                url += k + "=" + ((args[k] == void 0) ? "" : args[k]) + "&";
            }
        }
        return url.substr(0, url.length - 1);
    }
    var _EventDispatch = function(){
        this._listeners = [];
        this.on = function(callback){
            this._listeners.push(callback);
        }
        this.off = function(callback){
            var i = this._listeners.indexOf(callback);
            if(i > -1) {
                this._listeners.splice(i, 1);
            }
        }
        this.emit = function(arg){
            for(var j = 0,len = this._listeners.length; j < len; j++){
                this._listeners[j](arg);
            }
        }
        this.clear = function() {
            this._listeners = []
        }
    }
    var _httpGet = function(url, callback){
        var xhr = new XMLHttpRequest();
        var json = {error: 45, errstr: "http net failed"};
        xhr.onreadystatechange = ()=>{
            var ok = xhr.readyState == 4 && (xhr.status >= 200 && xhr.status < 400);
            if(ok) {
                console.log(config.url + url, xhr.responseText);
                json = JSON.parse(xhr.responseText);
                ok = json.error == 0;
                if(callback != void 0) {
                    callback(ok, json, xhr);
                }
            } else if(xhr.readyState == 4) {
                callback(false, json);
            }
        };
        xhr.onerror = ()=>{
            callback(false, json);
        };
        xhr.open("GET", encodeURI(config.url + url), true);
        xhr.send();
    }
    var C2S = function(name, args) {
        var pb = require("proto");
        var c2s = pb.C2S.create();
        var fname = name.substring(0,1).toLowerCase()+name.substring(1);
        var pb = pb[name].create();
        c2s[fname] = pb;
        pb.id = exports.login_id;
        pb.send = function () {
            var pb = require("proto");
            var buf  = pb.C2S.encode(c2s).finish();
            exports.logic._ws.send(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
        }
        if(args == void 0) {
            return pb;
        } else {
            for(var k in args){
                pb[k] = args[k];
            }
            pb.send();
        }
    }
    var _dispatchS2C = function(buf){
        var pb = require("proto");
        var s2c = pb.S2C.decode(buf);
        if(s2c.key == ""){
            for(var k in exports.logic){
                if(s2c[k] != null){
                    s2c.key = k;
                    break;
                }
            }
        }
        if(s2c.key != "") {
            s2c.key = s2c.key.substring(0,1).toLowerCase()+s2c.key.substring(1);
            var pbs2c = s2c[s2c.key];
            if(pbs2c.error == 0) {
                if(s2c.key == "gamerLoginS2C"){
                    exports.logic._session = pbs2c.main.session;
                } else if(s2c.key == "serverTimeS2C" || s2c.key == "gamerLoginGetDataS2C"){
                    exports.time = pbs2c.time;
                    if(s2c.key == "serverTimeS2C"){
                        exports.logic.ping = Math.round((now() - exports.logic._lastPingSend) * 1000);
                    }
                } else if(s2c.key == "gamerNotifyLoginOtherS2C"){
                    exports.logic._session = "";
                }
            }
            var dispatch = exports.logic[s2c.key];
            if(dispatch !== void 0 && dispatch != null){
                dispatch.emit(pbs2c);
            }
        }
        if(s2c.error > 0){
            if(s2c.error == 2001 || s2c.error == 2003 || s2c.error == 2004) {
                exports.logic._session = "";
            }
            exports.logic.onError.emit(s2c.error);
        }
    }
    exports.auth = {
        config: function(callback){
            _httpGet(genGetUrl("/config"), callback);
        },
        feedback: function(data, callback){
            _httpGet(genGetUrl("/feedback", {data:data}), callback);
        },
        register: function(name, passwd, callback){
            _httpGet(genGetUrl("/register", {channel:"mine", name:name, passwd:passwd}), callback);
        },
        login: function(name, passwd, callback) {
            _httpGet(genGetUrl("/login", {channel:config.channel, name:name, passwd:passwd}), callback);
        },
        newRole: function(session, name, type, server, avatar, callback) {
            _httpGet(genGetUrl("/newrole", {session:session, name:name, type:type, server:server, avatar:avatar}), callback);
        },
        useRole: function(session, id, callback) {
            exports.login_id = id;
            exports.logic._session = "";
            _httpGet(genGetUrl("/userole", {session:session, id:id}), function(ok, json, xhr){
                if(ok){
                    exports.logic._compress = json.server.compress;
                    if(config.url.indexOf("http://") == 0) {
                        exports.logic._addr = config.url.replace("http:", "ws:") + "/proxy";
                    } else if(config.url.indexOf("https://") == 0) {
                        exports.logic._addr = config.url.replace("https:", "wss:") + "/proxy";
                    }
                }
                callback(ok, json, xhr);
            });
        },
        fastLogin: function(name, channel, openid, callback) {
            _httpGet(genGetUrl("/fastlogin", {name:name, channel:channel, openid:openid}), function(ok, json, xhr){
                if(ok){
                    exports.login_id = json.roleId;
                    exports.logic._session = "";
                    exports.logic._compress = json.server.compress;
                    if(config.url.indexOf("http://") == 0) {
                        exports.logic._addr = config.url.replace("http:", "ws:") + "/proxy";
                    } else if(config.url.indexOf("https://") == 0) {
                        exports.logic._addr = config.url.replace("https:", "wss:") + "/proxy";
                    }
                }
                callback(ok, json, xhr);
            });
        },
        newAndUseRole: function(session, name, type, server, avatar, callback){
            var self = this;
            this.newRole(session, name, type, server, avatar, function(ok, json){
                ok ? self.useRole(json.session, json.roles[0].id, callback) : callback(ok, json);
            })
        },
        mineLogin: function(name, passwd, roleName, type, server, callback){
            var self = this;
            self.login(name, passwd, function(ok, json){
                ok ? (json.roles == null ? self.newAndUseRole(json.session, roleName, type, server, "", callback) : self.useRole(json.session, json.roles[0].id, callback)) :
                    json.error == 45 ? callback(ok, json) : self.register(name, passwd, function(ok, json) {
                        ok ? self.newAndUseRole(json.session, name, type, server, "", callback) : callback(ok, json);
                    });
            });
        },
        sdkLogin: function(name, passwd, roleName, type, server, avatar, callback){
            var self = this;
            self.login(name, passwd, function(ok, json){
                ok ? (json.roles == null ? self.newAndUseRole(json.session, roleName, type, server, avatar, callback) : self.useRole(json.session, json.roles[0].id, callback)) :
                    callback(ok, json);
            });
        }
    }

    exports.logic = {
        _addr: "",
        _ws: null,
        _session:"",
        _lastConnect:0,
        _heart:null,
        _compress:false,
        _lastPingSend:0,
        ping:50,
        connect: function(addr){
            this._lastConnect = now();
            if(addr != void 0) {
                this._addr = addr;
            }
            console.log("connect to addr:", this._addr, " session:", this._session);
            if(this._ws != null){
                this._ws.onmessage = null;
                this._ws.onerror = null;
                this._ws.onclose = null;
                this._ws.onopen = null;
                this._ws.close();
                this._ws = null;
            }
            var onopen = function(){
                clearInterval(this._heart);
                this._heart = setInterval(function(){
                    this.serverTimeC2S();
                    this._lastPingSend = now();
                }.bind(this), config.heartTime);
                this.gamerLoginC2S(this._session);
                console.log("connect to addr:", this._addr, " ok session:", this._session);
                this.onConnect.emit();
            }.bind(this);
            var onmessage = function(e){
                if(e.data instanceof ArrayBuffer){
                    var data = new Uint8Array(e.data, e.data.byteOffset, e.data.byteLength);
                    _dispatchS2C(exports.logic._compress ? require("pako").inflate(data) : data);
                } else if (e.data instanceof Blob) {
                    var reader = new FileReader();
                    reader.readAsArrayBuffer(e.data);
                    reader.onload = function(evt){
                        if(evt.target.readyState == FileReader.DONE){
                            var data = new Uint8Array(evt.target.result)
                            _dispatchS2C(exports.logic._compress ? require("pako").inflate(data) : data);
                        }
                    }
                }
            };
            var onclose = function(e){
                console.log("onclose", e);
                clearInterval(this._heart);
                console.log("reconnect to addr:", this._addr, " session:", this._session);
                if(this._addr == "" || this._session == ""){
                    this.onClose.emit();
                } else {
                    this.onReconnect.emit();
                    if(now() - this._lastConnect >= 1){
                        this.connect();
                    }
                    this._heart = setInterval(function(){
                        this.onReconnect.emit();
                        this.connect();
                    }.bind(this), 1000);
                }
            }.bind(this);
            var onerror = function(e){
                console.log("onerror", e);
                onclose();
            }.bind(this);

            this._ws = new WebSocket(this._addr);
            this._ws.binaryType="arraybuffer";
            this._ws.onopen = onopen;
            this._ws.onmessage = onmessage;
            this._ws.onerror = onerror;
            this._ws.onclose = onclose;
        },
        onError: new _EventDispatch(),
        onConnect:  new _EventDispatch(),
        onClose:  new _EventDispatch(),
        onReconnect: new _EventDispatch(),

gamerLoginC2S: function(session, addr){
	C2S("GamerLoginC2S", {session:session, addr:addr});
},
gamerLoginS2C: new _EventDispatch(),

gamerLoginGetDataC2S: function(){
	C2S("GamerLoginGetDataC2S", {});
},
gamerLoginGetDataS2C: new _EventDispatch(),

serverTimeC2S: function(){
	C2S("ServerTimeC2S", {});
},
serverTimeS2C: new _EventDispatch(),

gamerSubChatChannelC2S: function(channel, open){
	C2S("GamerSubChatChannelC2S", {channel:channel, open:open});
},
gamerSubChatChannelS2C: new _EventDispatch(),

gamerChangeNameC2S: function(newName){
	C2S("GamerChangeNameC2S", {newName:newName});
},
gamerChangeNameS2C: new _EventDispatch(),

gamerBuyItemC2S: function(item, count){
	C2S("GamerBuyItemC2S", {item:item, count:count});
},
gamerBuyItemS2C: new _EventDispatch(),

gamerUseItemC2S: function(item, count){
	C2S("GamerUseItemC2S", {item:item, count:count});
},
gamerUseItemS2C: new _EventDispatch(),

gamerSellItemC2S: function(item, count){
	C2S("GamerSellItemC2S", {item:item, count:count});
},
gamerSellItemS2C: new _EventDispatch(),

gamerFriendChatC2S: function(toId, msg){
	C2S("GamerFriendChatC2S", {toId:toId, msg:msg});
},
gamerFriendChatS2C: new _EventDispatch(),

gamerWorldChatC2S: function(server, msg){
	C2S("GamerWorldChatC2S", {server:server, msg:msg});
},
gamerWorldChatS2C: new _EventDispatch(),

gamerTestChatC2S: function(toId, msg){
	C2S("GamerTestChatC2S", {toId:toId, msg:msg});
},
gamerTestChatS2C: new _EventDispatch(),

gamerClubRequestC2S: function(clubId, msg){
	C2S("GamerClubRequestC2S", {clubId:clubId, msg:msg});
},
gamerClubRequestS2C: new _EventDispatch(),

gamerNewFriendReqC2S: function(oid, msg){
	C2S("GamerNewFriendReqC2S", {oid:oid, msg:msg});
},
gamerNewFriendReqS2C: new _EventDispatch(),

gamerDelFriendC2S: function(oid){
	C2S("GamerDelFriendC2S", {oid:oid});
},
gamerDelFriendS2C: new _EventDispatch(),

gamerProcessFriendReqC2S: function(oid, result){
	C2S("GamerProcessFriendReqC2S", {oid:oid, result:result});
},
gamerProcessFriendReqS2C: new _EventDispatch(),

gamerNewHeroC2S: function(heroId){
	C2S("GamerNewHeroC2S", {heroId:heroId});
},
gamerNewHeroS2C: new _EventDispatch(),

gamerUpgradeHeroC2S: function(lid){
	C2S("GamerUpgradeHeroC2S", {lid:lid});
},
gamerUpgradeHeroS2C: new _EventDispatch(),

gamerChoseHeroC2S: function(lid){
	C2S("GamerChoseHeroC2S", {lid:lid});
},
gamerChoseHeroS2C: new _EventDispatch(),

gamerMatchC2S: function(type, hero){
	C2S("GamerMatchC2S", {type:type, hero:hero});
},
gamerMatchS2C: new _EventDispatch(),

gamerCancelMatchC2S: function(){
	C2S("GamerCancelMatchC2S", {});
},
gamerCancelMatchS2C: new _EventDispatch(),

gamerPVPSyncC2S: function(session, input, needFrames, crc, agents, reconn, index, addr, result){
	C2S("GamerPVPSyncC2S", {session:session, input:input, needFrames:needFrames, crc:crc, agents:agents, reconn:reconn, index:index, addr:addr, result:result});
},
gamerPVPSyncS2C: new _EventDispatch(),

gamerPVPStateSyncC2S: function(session, result, stateSync){
	C2S("GamerPVPStateSyncC2S", {session:session, result:result, stateSync:stateSync});
},
gamerPVPStateSyncS2C: new _EventDispatch(),

gamerGetRealTimeRankC2S: function(){
	C2S("GamerGetRealTimeRankC2S", {});
},
gamerGetRealTimeRankS2C: new _EventDispatch(),

gamerCheckPVPBattleC2S: function(session){
	C2S("GamerCheckPVPBattleC2S", {session:session});
},
gamerCheckPVPBattleS2C: new _EventDispatch(),

gamerUploadWXInfoC2S: function(wxInfo){
	C2S("GamerUploadWXInfoC2S", {wxInfo:wxInfo});
},
gamerUploadWXInfoS2C: new _EventDispatch(),

gamerNewRoomC2S: function(type, hero){
	C2S("GamerNewRoomC2S", {type:type, hero:hero});
},
gamerNewRoomS2C: new _EventDispatch(),

gamerAddRoomC2S: function(roomId, hero){
	C2S("GamerAddRoomC2S", {roomId:roomId, hero:hero});
},
gamerAddRoomS2C: new _EventDispatch(),

gamerLeaveRoomC2S: function(roomId){
	C2S("GamerLeaveRoomC2S", {roomId:roomId});
},
gamerLeaveRoomS2C: new _EventDispatch(),

gamerGetRewardC2S: function(type){
	C2S("GamerGetRewardC2S", {type:type});
},
gamerGetRewardS2C: new _EventDispatch(),

gamerUseIconC2S: function(type, count, session){
	C2S("GamerUseIconC2S", {type:type, count:count, session:session});
},
gamerUseIconS2C: new _EventDispatch(),
gamerNotifyLoginOtherS2C: new _EventDispatch(),
gamerNotifyNewChatS2C: new _EventDispatch(),
gamerNotifyNewFriendReqS2C: new _EventDispatch(),
gamerNotifyNewFriendS2C: new _EventDispatch(),
gamerNotifyDelFriendS2C: new _EventDispatch(),
gamerNotifyNewMailS2C: new _EventDispatch(),
gamerNotifyMatchInfoS2C: new _EventDispatch(),
gamerNotifyGamerMiniS2C: new _EventDispatch(),
gamerNotifyPVPSyncS2C: new _EventDispatch(),
gamerNotifyNewPVPResultS2C: new _EventDispatch(),
gamerNotifyPVPStateSyncS2C: new _EventDispatch(),
gamerNotifyIconChangeS2C: new _EventDispatch(),
gamerNotifyDiamonChangeS2C: new _EventDispatch(),
gamerNotifyEnergyChangeS2C: new _EventDispatch(),
gamerNotifyExpChangeS2C: new _EventDispatch(),
gamerNotifyRoomInfoChangeS2C: new _EventDispatch(),

}})()