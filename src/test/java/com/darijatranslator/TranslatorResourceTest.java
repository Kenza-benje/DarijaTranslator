package com.darijatranslator;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.StringReader;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TranslatorResourceTest {
    @Mock
    GeminiService geminiService;

    @InjectMocks
    TranslatorResource resource;

    @Test
    void translatesEnglishAndPreservesArabicUnicode() throws Exception {
        String darija = "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064a\u0643\u0645\u060c \u0645\u0631\u062d\u0628\u0627 \u0641\u0627\u0644\u0645\u063a\u0631\u0628 \uD83C\uDDF2\uD83C\uDDE6";
        when(geminiService.translate("Hello")).thenReturn(darija);

        try (Response response = resource.translate("{\"text\":\"Hello\"}")) {
            assertEquals(Json.createObjectBuilder().add("translation", darija).build(), json(response, 200));
        }
        verify(geminiService).translate("Hello");
        verifyNoMoreInteractions(geminiService);
    }

    @Test
    void acceptsValidJsonAndPreservesEscapesAndWhitespace() throws Exception {
        String english = "  Say \"hello\"\nfrom C:\\home  ";
        String darija = "\u0642\u0627\u0644 \"\u0633\u0644\u0627\u0645\"\n\u0645\u0646 \u0627\u0644\u062f\u0627\u0631\\";
        when(geminiService.translate(english)).thenReturn(darija);
        String body = Json.createObjectBuilder().add("text", english).add("extra", true).build().toString();

        try (Response response = resource.translate(body)) {
            assertEquals(Json.createObjectBuilder().add("translation", darija).build(), json(response, 200));
        }
        verify(geminiService).translate(english);
        verifyNoMoreInteractions(geminiService);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" \n\t "})
    void rejectsEmptyBody(String body) {
        assertBadRequest(body, "A JSON body with non-empty text is required.");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{", "not JSON", "[]", "null", "42"})
    void rejectsMalformedJsonOrNonObjectRoot(String body) {
        assertBadRequest(body, "Invalid JSON object.");
    }

    @Test
    void rejectsMissingText() {
        assertBadRequest("{\"other\":\"Hello\"}", "text must be a non-empty string.");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "\n\t\r"})
    void rejectsBlankText(String text) {
        assertBadRequest(Json.createObjectBuilder().add("text", text).build().toString(),
                "text must be a non-empty string.");
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "true", "42", "1.5", "[]", "{}"})
    void rejectsNonStringText(String value) {
        assertBadRequest("{\"text\":" + value + "}", "text must be a non-empty string.");
    }

    @ParameterizedTest
    @ValueSource(ints = {502, 503, 504})
    void preservesGeminiServiceErrorStatusAndJsonMessage(int status) throws Exception {
        String message = "Service unavailable: \"\u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627\"\nPlease retry.";
        when(geminiService.translate("Hello"))
                .thenThrow(new GeminiService.TranslationException(status, message));

        try (Response response = resource.translate("{\"text\":\"Hello\"}")) {
            assertEquals(Json.createObjectBuilder().add("error", message).build(), json(response, status));
        }
        verify(geminiService).translate("Hello");
        verifyNoMoreInteractions(geminiService);
    }

    @Test
    void helloDoesNotCallGemini() {
        assertEquals("Hello from Darija Translator!", resource.hello());
        verifyNoInteractions(geminiService);
    }

    private void assertBadRequest(String body, String message) {
        try (Response response = resource.translate(body)) {
            assertEquals(Json.createObjectBuilder().add("error", message).build(), json(response, 400));
        }
        verifyNoInteractions(geminiService);
    }

    private JsonObject json(Response response, int status) {
        assertEquals(status, response.getStatus());
        assertEquals(MediaType.APPLICATION_JSON_TYPE, response.getMediaType());
        String entity = assertInstanceOf(String.class, response.getEntity());
        try (var reader = Json.createReader(new StringReader(entity))) {
            return reader.readObject();
        }
    }
}
