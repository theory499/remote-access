import Foundation

enum InputEventEncoder {
    static let buttons: Set<String> = ["left", "right", "middle"]
    static let modifiers: Set<String> = ["control", "shift", "alt", "meta"]
    static let typeTextMaxLength = 256

    static let keys: Set<String> = {
        var set = Set<String>()
        for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" { set.insert(String(ch)) }
        for n in 0...9 { set.insert(String(n)) }
        set.formUnion(["Space", "Enter", "Tab", "Backspace", "Delete", "Escape"])
        set.formUnion(["Left", "Right", "Up", "Down"])
        set.formUnion(["Home", "End", "PageUp", "PageDown"])
        for n in 1...12 { set.insert("F\(n)") }
        return set
    }()

    static func mouseMove(x: Double, y: Double) -> String {
        encode(["type": "mousemove", "x": clamp(x), "y": clamp(y)])
    }

    static func mouseDown(button: String) throws -> String {
        guard buttons.contains(button) else { throw EncoderError.unknownButton(button) }
        return encode(["type": "mousedown", "button": button])
    }

    static func mouseUp(button: String) throws -> String {
        guard buttons.contains(button) else { throw EncoderError.unknownButton(button) }
        return encode(["type": "mouseup", "button": button])
    }

    static func click(x: Double, y: Double, button: String) throws -> String {
        guard buttons.contains(button) else { throw EncoderError.unknownButton(button) }
        return encode(["type": "click", "x": clamp(x), "y": clamp(y), "button": button])
    }

    static func scroll(dx: Int, dy: Int) -> String {
        encode(["type": "scroll", "dx": dx, "dy": dy])
    }

    static func keyDown(key: String, modifiers mods: [String] = []) throws -> String {
        try ensureKey(key)
        for m in mods { guard modifiers.contains(m) else { throw EncoderError.unknownModifier(m) } }
        return encode(["type": "keydown", "key": key, "modifiers": mods])
    }

    static func keyUp(key: String, modifiers mods: [String] = []) throws -> String {
        try ensureKey(key)
        for m in mods { guard modifiers.contains(m) else { throw EncoderError.unknownModifier(m) } }
        return encode(["type": "keyup", "key": key, "modifiers": mods])
    }

    static func typeText(_ text: String) throws -> String {
        guard !text.isEmpty else { throw EncoderError.emptyText }
        let truncated = String(text.prefix(typeTextMaxLength))
        return encode(["type": "type", "text": truncated])
    }

    static func ping(id: Int) -> String { encode(["type": "ping", "id": id]) }
    static func pong(id: Int) -> String { encode(["type": "pong", "id": id]) }

    private static func clamp(_ v: Double) -> Double { min(1.0, max(0.0, v)) }

    private static func ensureKey(_ key: String) throws {
        guard keys.contains(key) else { throw EncoderError.unknownKey(key) }
    }

    private static func encode(_ dict: [String: Any]) -> String {
        let data = try! JSONSerialization.data(withJSONObject: dict, options: [])
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    enum EncoderError: Error {
        case unknownButton(String)
        case unknownKey(String)
        case unknownModifier(String)
        case emptyText
    }
}
