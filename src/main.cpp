#include <napi.h>
#include "mouse_control.h"

Napi::Value MoveTo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要两个参数").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int x = info[0].As<Napi::Number>().Int32Value();
    int y = info[1].As<Napi::Number>().Int32Value();
    
    MouseControl::MoveTo(x, y);
    return env.Undefined();
}

Napi::Value Click(const Napi::CallbackInfo& info) {
    MouseControl::Click();
    return info.Env().Undefined();
}

Napi::Value GetPosition(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    int x, y;
    MouseControl::GetPosition(x, y);
    
    Napi::Object pos = Napi::Object::New(env);
    pos.Set("x", x);
    pos.Set("y", y);
    return pos;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("moveTo", Napi::Function::New(env, MoveTo));
    exports.Set("click", Napi::Function::New(env, Click));
    exports.Set("getPosition", Napi::Function::New(env, GetPosition));
    return exports;
}

NODE_API_MODULE(mouse_control, Init) 
