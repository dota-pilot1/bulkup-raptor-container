package com.bulkup.raptor.common.error;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "요청값이 올바르지 않습니다."),
    PASSWORD_CONFIRM_MISMATCH(HttpStatus.BAD_REQUEST, "비밀번호와 비밀번호 확인이 일치하지 않습니다."),
    WEAK_PASSWORD(HttpStatus.BAD_REQUEST, "비밀번호는 영문과 숫자를 포함해야 합니다."),
    TERMS_NOT_AGREED(HttpStatus.BAD_REQUEST, "필수 약관에 동의해 주세요."),
    EMAIL_VERIFICATION_REQUIRED(HttpStatus.BAD_REQUEST, "이메일 인증을 먼저 완료해 주세요."),
    EMAIL_VERIFICATION_NOT_FOUND(HttpStatus.NOT_FOUND, "이메일 인증 요청을 찾을 수 없습니다."),
    EMAIL_VERIFICATION_CODE_INVALID(HttpStatus.BAD_REQUEST, "인증번호가 올바르지 않습니다."),
    EMAIL_VERIFICATION_ALREADY_CONFIRMED(HttpStatus.BAD_REQUEST, "이미 인증이 완료된 요청입니다."),
    EMAIL_VERIFICATION_EXPIRED(HttpStatus.BAD_REQUEST, "인증번호가 만료되었습니다. 다시 요청해 주세요."),
    EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "인증번호 입력 횟수를 초과했습니다."),
    EMAIL_VERIFICATION_ALREADY_USED(HttpStatus.BAD_REQUEST, "이미 사용된 이메일 인증입니다."),
    EMAIL_VERIFICATION_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "잠시 후 인증번호를 다시 요청해 주세요."),
    MEMBER_EMAIL_DUPLICATED(HttpStatus.CONFLICT, "이미 가입된 이메일입니다."),
    LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."),
    LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    MEMBER_SUSPENDED(HttpStatus.FORBIDDEN, "이용이 제한된 계정입니다."),
    MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."),
    ADMIN_REQUIRED(HttpStatus.FORBIDDEN, "관리자만 회원 역할을 변경할 수 있습니다."),
    SELF_ROLE_CHANGE(HttpStatus.CONFLICT, "자신의 관리자 역할은 변경할 수 없습니다."),
    PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND, "상품을 찾을 수 없습니다."),
    IMAGE_FILE_REQUIRED(HttpStatus.BAD_REQUEST, "이미지 파일을 선택해 주세요."),
    IMAGE_FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "이미지는 5MB 이하로 업로드해 주세요."),
    IMAGE_TYPE_NOT_SUPPORTED(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "JPG, PNG, WebP 이미지만 업로드할 수 있습니다."),
    IMAGE_FILE_INVALID(HttpStatus.BAD_REQUEST, "올바른 이미지 파일이 아닙니다."),
    IMAGE_DIMENSIONS_TOO_LARGE(HttpStatus.BAD_REQUEST, "이미지 가로와 세로는 각각 4096픽셀 이하여야 합니다."),
    IMAGE_STORAGE_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "이미지 저장소 설정이 필요합니다."),
    IMAGE_STORAGE_FAILED(HttpStatus.BAD_GATEWAY, "이미지 저장에 실패했습니다. 잠시 후 다시 시도해 주세요."),
    ROLE_NOT_FOUND(HttpStatus.NOT_FOUND, "역할을 찾을 수 없습니다."),
    PERMISSION_CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, "권한 카테고리를 찾을 수 없습니다."),
    PERMISSION_CATEGORY_IN_USE(HttpStatus.CONFLICT, "권한을 다른 카테고리로 옮긴 뒤 삭제해 주세요."),
    PERMISSION_NOT_FOUND(HttpStatus.NOT_FOUND, "권한을 찾을 수 없습니다."),
    RBAC_DUPLICATE_CODE(HttpStatus.CONFLICT, "이미 사용 중인 코드입니다."),
    RBAC_SYSTEM_PROTECTED(HttpStatus.CONFLICT, "기본 항목은 삭제할 수 없으며 MEMBER와 ADMIN의 권한은 고정됩니다."),
    RBAC_OPERATOR_PERMISSION(HttpStatus.FORBIDDEN, "운영자는 관리자 페이지 접근과 상품·주문·배송 기능 권한만 설정할 수 있습니다."),
    RBAC_IN_USE(HttpStatus.CONFLICT, "사용 중인 역할 또는 권한입니다. 연결을 먼저 해제해 주세요."),
    RBAC_ADMIN_PERMISSION(HttpStatus.FORBIDDEN, "관리자 전용 권한은 다른 역할에 부여할 수 없습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버에서 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String defaultMessage;
}
