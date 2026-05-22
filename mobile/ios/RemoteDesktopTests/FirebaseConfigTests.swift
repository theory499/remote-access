import XCTest
@testable import RemoteDesktop

final class FirebaseConfigTests: XCTestCase {

    private let validPayload = """
    {
      "v": 1,
      "backend": "firebase",
      "ios": {
        "apiKey": "AIza-ios",
        "googleAppId": "1:1:ios:abc",
        "projectId": "demo",
        "databaseURL": "https://demo-default-rtdb.firebaseio.com",
        "bundleId": "com.remotedesktop.ios"
      },
      "projectId": "demo",
      "databaseURL": "https://demo-default-rtdb.firebaseio.com"
    }
    """

    func testParsesValidPayload() throws {
        let config = try XCTUnwrap(FirebaseConfig.fromQrPayload(validPayload))
        XCTAssertEqual(config.apiKey, "AIza-ios")
        XCTAssertEqual(config.googleAppId, "1:1:ios:abc")
        XCTAssertEqual(config.projectId, "demo")
        XCTAssertEqual(config.bundleId, "com.remotedesktop.ios")
    }

    func testRejectsWrongVersion() {
        let broken = validPayload.replacingOccurrences(of: "\"v\": 1", with: "\"v\": 2")
        XCTAssertNil(FirebaseConfig.fromQrPayload(broken))
    }

    func testRejectsMissingIos() {
        let broken = """
        {"v":1,"backend":"firebase","android":{"apiKey":"x","applicationId":"y","projectId":"z","databaseURL":"u"}}
        """
        XCTAssertNil(FirebaseConfig.fromQrPayload(broken))
    }

    func testRejectsMalformed() {
        XCTAssertNil(FirebaseConfig.fromQrPayload(""))
        XCTAssertNil(FirebaseConfig.fromQrPayload("garbage"))
    }
}

final class PairingCodeTests: XCTestCase {
    func testNormaliseFiltersAmbiguous() {
        XCTAssertEqual("ABCDEF", PairingCode.normalise("abc0def"))
        XCTAssertEqual("ABCDEF", PairingCode.normalise("ABCDEFGHJ"))
    }

    func testIsValid() {
        XCTAssertTrue(PairingCode.isValid("ABCDEF"))
        XCTAssertFalse(PairingCode.isValid("ABCDE0"))
        XCTAssertFalse(PairingCode.isValid("abcdef"))
        XCTAssertFalse(PairingCode.isValid("ABCDE"))
    }
}

final class InputEventEncoderTests: XCTestCase {
    func testMouseMoveClamps() throws {
        let json = InputEventEncoder.mouseMove(x: 2.0, y: -1.0)
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
        XCTAssertEqual(obj["x"] as? Double, 1.0)
        XCTAssertEqual(obj["y"] as? Double, 0.0)
    }

    func testKeyDownRejectsUnknownKey() {
        XCTAssertThrowsError(try InputEventEncoder.keyDown(key: "AltGr"))
    }

    func testTypeTextTruncates() throws {
        let long = String(repeating: "x", count: InputEventEncoder.typeTextMaxLength + 50)
        let json = try InputEventEncoder.typeText(long)
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
        XCTAssertEqual((obj["text"] as? String)?.count, InputEventEncoder.typeTextMaxLength)
    }
}
