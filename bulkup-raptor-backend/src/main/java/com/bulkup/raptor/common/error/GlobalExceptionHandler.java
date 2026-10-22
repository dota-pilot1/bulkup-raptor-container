package com.bulkup.raptor.common.error;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleConflict(
            org.springframework.dao.DataIntegrityViolationException exception) {
        return ResponseEntity.status(409)
                .body(
                        ProblemDetail.forStatusAndDetail(
                                org.springframework.http.HttpStatus.CONFLICT,
                                "중복 값이나 사용 중인 데이터로 요청을 처리할 수 없습니다."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(NoResourceFoundException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(exception.getBody());
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ProblemDetail> handleBusiness(
            BusinessException exception, HttpServletRequest request) {
        ErrorCode errorCode = exception.getErrorCode();
        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(errorCode.getStatus(), exception.getMessage());
        problem.setTitle(errorCode.name());
        problem.setProperty("code", errorCode.name());
        problem.setProperty("path", request.getRequestURI());
        return ResponseEntity.status(errorCode.getStatus()).body(problem);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(
            MethodArgumentNotValidException exception, HttpServletRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception
                .getBindingResult()
                .getFieldErrors()
                .forEach(
                        error ->
                                fieldErrors.putIfAbsent(
                                        error.getField(), error.getDefaultMessage()));
        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(
                        ErrorCode.INVALID_INPUT.getStatus(),
                        ErrorCode.INVALID_INPUT.getDefaultMessage());
        problem.setTitle(ErrorCode.INVALID_INPUT.name());
        problem.setProperty("code", ErrorCode.INVALID_INPUT.name());
        problem.setProperty("path", request.getRequestURI());
        problem.setProperty("fieldErrors", fieldErrors);
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        HandlerMethodValidationException.class,
        MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ProblemDetail> handleUnreadable(
            Exception exception, HttpServletRequest request) {
        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(
                        ErrorCode.INVALID_INPUT.getStatus(),
                        ErrorCode.INVALID_INPUT.getDefaultMessage());
        problem.setTitle(ErrorCode.INVALID_INPUT.name());
        problem.setProperty("code", ErrorCode.INVALID_INPUT.name());
        problem.setProperty("path", request.getRequestURI());
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpected(
            Exception exception, HttpServletRequest request) {
        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(
                        ErrorCode.INTERNAL_ERROR.getStatus(),
                        ErrorCode.INTERNAL_ERROR.getDefaultMessage());
        problem.setTitle(ErrorCode.INTERNAL_ERROR.name());
        problem.setProperty("code", ErrorCode.INTERNAL_ERROR.name());
        problem.setProperty("path", request.getRequestURI());
        return ResponseEntity.internalServerError().body(problem);
    }
}
