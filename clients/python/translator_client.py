
import base64
import getpass
import json
import urllib.request
import urllib.error

URL = "http://192.168.1.4:8080/DarijaTranslator/api/translator/translate"


def main():
    print("=== Darija Translator ===")

    text = input("Enter English text: ").strip()
    if not text:
        print("Text cannot be empty.")
        return

    username = input("WildFly username: ")
    password = getpass.getpass("WildFly password: ")
    if not username or not password:
        print("Username and password are required.")
        return
    if ":" in username:
        print("A Basic Authentication username cannot contain a colon.")
        return

    credentials = f"{username}:{password}"
    encoded = base64.b64encode(
        credentials.encode("utf-8")
    ).decode("ascii")

    data = json.dumps(
        {"text": text},
        ensure_ascii=False
    ).encode("utf-8")

    req = urllib.request.Request(
        URL,
        data=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "Authorization": f"Basic {encoded}"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=200) as response:
            result = json.loads(response.read().decode("utf-8"))
            if (not isinstance(result, dict)
                    or not isinstance(result.get("translation"), str)
                    or not result["translation"].strip()):
                raise ValueError("The server returned no valid translation.")
            print("Darija:", result["translation"])

    except urllib.error.HTTPError as e:
        print(f"Server error: HTTP {e.code}")
        print(e.read().decode("utf-8", errors="replace"))

    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}")

    except (TimeoutError, OSError) as e:
        print(f"Connection error: {e}")

    except (ValueError, KeyError) as e:
        print(f"Invalid response: {e}")


if __name__ == "__main__":
    main()

