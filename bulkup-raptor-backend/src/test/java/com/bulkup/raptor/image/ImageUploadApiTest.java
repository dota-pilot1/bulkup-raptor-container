package com.bulkup.raptor.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.common.error.GlobalExceptionHandler;
import com.bulkup.raptor.config.SecurityConfig;
import com.bulkup.raptor.image.api.ImageUploadController;
import com.bulkup.raptor.image.application.port.ImageStorage;
import com.bulkup.raptor.image.application.service.ImageUploadService;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@SpringJUnitWebConfig(ImageUploadApiTest.Config.class)
class ImageUploadApiTest {
    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, ImageUploadController.class, ImageUploadService.class, com.bulkup.raptor.image.application.service.RegisteredImageUploadService.class, GlobalExceptionHandler.class})
    static class Config {
        @Bean ImageStorage storage() { return mock(ImageStorage.class); }
        @Bean com.bulkup.raptor.image.repository.UploadedImageRepository images() { return mock(com.bulkup.raptor.image.repository.UploadedImageRepository.class); }
        @Bean MemberRepository members() { return mock(MemberRepository.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired ImageStorage storage;
    @Autowired MemberRepository members;
    @Autowired com.bulkup.raptor.image.repository.UploadedImageRepository images;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        reset(storage, members, images);
        var row = mock(MemberRepository.SessionState.class);
        when(row.getStatus()).thenReturn(com.bulkup.raptor.auth.domain.MemberStatus.ACTIVE);
        when(row.getRoleId()).thenReturn(1L);
        when(row.getRoleCode()).thenReturn("MEMBER");
        when(row.getPermissionVersion()).thenReturn(0L);
        when(members.findSessionState(1L)).thenReturn(java.util.List.of(row));
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(storage.upload(anyString(), any(byte[].class), anyString()))
                .thenAnswer(call -> "https://images.example.com/" + call.getArgument(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"png", "jpg", "webp"})
    void uploadsSupportedImageWithGeneratedKey(String format) throws Exception {
        byte[] bytes;
        if (format.equals("webp")) {
            try (var input = getClass().getResourceAsStream("/images/sample.webp")) {
                bytes = input.readAllBytes();
            }
        } else {
            bytes = image(format, 2, 3);
        }
        String type = "image/" + (format.equals("jpg") ? "jpeg" : format);
        mvc.perform(multipart("/api/admin/images")
                        .file(new MockMultipartFile("file", "../../unsafe." + format, type, bytes))
                        .with(member("operator").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value(org.hamcrest.Matchers.matchesPattern(
                        "images/[0-9a-f-]{36}\\." + format)))
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("https://images.example.com/images/")))
                .andExpect(jsonPath("$.contentType").value(type))
                .andExpect(jsonPath("$.size").value(bytes.length))
                .andExpect(jsonPath("$.width").isNumber())
                .andExpect(jsonPath("$.height").isNumber());
        verify(storage).upload(anyString(), eq(bytes), eq(type));
    }

    @ParameterizedTest
    @ValueSource(strings = {"png", "jpg", "webp"})
    void authenticatedMemberCanUploadThroughGenericApi(String format) throws Exception {
        byte[] bytes;
        if (format.equals("webp")) {
            try (var input = getClass().getResourceAsStream("/images/sample.webp")) {
                bytes = input.readAllBytes();
            }
        } else {
            bytes = image(format, 2, 3);
        }
        String type = "image/" + (format.equals("jpg") ? "jpeg" : format);
        mvc.perform(multipart("/api/images")
                        .file(new MockMultipartFile("file", "test." + format, type, bytes))
                        .with(member("member").authorities(new SimpleGrantedAuthority("ROLE_MEMBER"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value(org.hamcrest.Matchers.matchesPattern(
                        "images/[0-9a-f-]{36}\\." + format)))
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("https://images.example.com/images/")))
                .andExpect(jsonPath("$.contentType").value(type))
                .andExpect(jsonPath("$.size").value(bytes.length));
        verify(storage).upload(anyString(), eq(bytes), eq(type));
    }

    @Test
    void genericApiRequiresAuthentication() throws Exception {
        mvc.perform(multipart("/api/images").file(file("image/png", image("png", 1, 1))))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(storage);
    }

    @Test
    void genericApiUsesTheSameValidation() throws Exception {
        mvc.perform(multipart("/api/images").file(file("image/jpeg", image("png", 1, 1)))
                        .with(member("member")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IMAGE_FILE_INVALID"));
        verifyNoInteractions(storage);
    }

    @Test
    void anonymousCannotUpload() throws Exception {
        mvc.perform(multipart("/api/admin/images").file(file("image/png", image("png", 1, 1))))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(storage);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MENU_ADMIN_ACCESS", "ROLE_ADMIN", "ROLE_MEMBER"})
    void menuOrRoleAloneDoesNotPermitUpload(String authority) throws Exception {
        mvc.perform(multipart("/api/admin/images").file(file("image/png", image("png", 1, 1)))
                        .with(member("reader").authorities(new SimpleGrantedAuthority(authority))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(storage);
    }

    @Test
    void missingAndEmptyFilesAreRejected() throws Exception {
        mvc.perform(multipart("/api/admin/images").with(member("admin").authorities(
                        new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("IMAGE_FILE_REQUIRED"));
        reject("image/png", new byte[0], 400, "IMAGE_FILE_REQUIRED");
    }

    @Test
    void unrecognizedOrMismatchedImageFormatsAreRejected() throws Exception {
        reject("image/png", "not an image".getBytes(), 400, "IMAGE_FILE_INVALID");
        reject("image/jpeg", image("png", 1, 1), 400, "IMAGE_FILE_INVALID");
    }

    @Test
    void acceptsImageHeaderWhileDecodingValidationIsDeferred() throws Exception {
        byte[] png = image("png", 5, 5);
        byte[] truncated = java.util.Arrays.copyOf(png, 35);
        mvc.perform(multipart("/api/admin/images").file(file("image/png", truncated))
                        .with(member("admin").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(5))
                .andExpect(jsonPath("$.height").value(5));
        verify(storage).upload(anyString(), eq(truncated), eq("image/png"));
    }

    @Test
    void unsupportedAndMissingContentTypesAreRejected() throws Exception {
        reject("image/svg+xml", "<svg/>".getBytes(), 415, "IMAGE_TYPE_NOT_SUPPORTED");
        reject(null, image("png", 1, 1), 415, "IMAGE_TYPE_NOT_SUPPORTED");
    }

    @Test
    void oversizedBytesAreRejected() throws Exception {
        reject("image/png", new byte[(int) ImageUploadService.MAX_FILE_SIZE + 1], 413, "IMAGE_FILE_TOO_LARGE");
    }

    @Test
    void acceptsLargeDimensionsWhileMaximumDimensionValidationIsDeferred() throws Exception {
        byte[] bytes = image("png", 4097, 1);
        mvc.perform(multipart("/api/admin/images").file(file("image/png", bytes))
                        .with(member("admin").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(4097))
                .andExpect(jsonPath("$.height").value(1));
        verify(storage).upload(anyString(), eq(bytes), eq("image/png"));
    }

    @Test
    void storageFailureIsReturnedWithoutInternalDetails() throws Exception {
        when(storage.upload(anyString(), any(), anyString()))
                .thenThrow(new BusinessException(ErrorCode.IMAGE_STORAGE_FAILED));
        mvc.perform(multipart("/api/admin/images").file(file("image/png", image("png", 1, 1)))
                        .with(member("admin").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("IMAGE_STORAGE_FAILED"));
    }

    @Test
    void jsonIsNotAnUpload() throws Exception {
        mvc.perform(post("/api/admin/images").contentType("application/json").content("{}")
                        .with(member("admin").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isUnsupportedMediaType());
        verifyNoInteractions(storage);
    }

    private TestMember member(String ignoredName) { return new TestMember(); }

    private static class TestMember implements org.springframework.test.web.servlet.request.RequestPostProcessor {
        private java.util.List<org.springframework.security.core.GrantedAuthority> authorities =
                java.util.List.of(new SimpleGrantedAuthority("ROLE_MEMBER"));

        TestMember authorities(org.springframework.security.core.GrantedAuthority... values) {
            authorities = java.util.List.of(values);
            return this;
        }

        @Override
        public org.springframework.mock.web.MockHttpServletRequest postProcessRequest(
                org.springframework.mock.web.MockHttpServletRequest request) {
            var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                    1L, null, authorities);
            auth.setDetails(new com.bulkup.raptor.auth.infrastructure.session.MemberSessionDetails(
                    0L, java.util.Map.of(1L, new com.bulkup.raptor.auth.infrastructure.session.RoleState("MEMBER", 0L))));
            return authentication(auth).postProcessRequest(request);
        }
    }

    private void reject(String type, byte[] bytes, int status, String code) throws Exception {
        mvc.perform(multipart("/api/admin/images").file(file(type, bytes))
                        .with(member("admin").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code));
        verifyNoInteractions(storage);
    }

    private MockMultipartFile file(String type, byte[] bytes) {
        return new MockMultipartFile("file", "test.png", type, bytes);
    }

    private byte[] image(String format, int width, int height) throws Exception {
        var output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, output)).isTrue();
        return output.toByteArray();
    }
}
