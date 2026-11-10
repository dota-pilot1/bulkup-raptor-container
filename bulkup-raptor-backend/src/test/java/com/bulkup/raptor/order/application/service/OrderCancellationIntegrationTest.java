package com.bulkup.raptor.order.application.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.infrastructure.session.*;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.delivery.api.ChangeDeliveryStatusRequest;
import com.bulkup.raptor.delivery.application.service.*;
import com.bulkup.raptor.delivery.domain.DeliveryStatus;
import com.bulkup.raptor.delivery.repository.*;
import com.bulkup.raptor.inventory.application.service.StockReservationService;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.application.service.VerifyPaymentService;
import com.bulkup.raptor.payment.domain.*;
import com.bulkup.raptor.payment.infrastructure.PortOnePaymentClient;
import com.bulkup.raptor.payment.infrastructure.PortOnePaymentClient.RemotePayment;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import com.bulkup.raptor.product.domain.*;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {"app.stock.reservation.expiry.enabled=false", "spring.jpa.show-sql=false"})
class OrderCancellationIntegrationTest {
    @Autowired OrderCancellationService cancellation;
    @Autowired OrderService query;
    @Autowired DeliveryService shipping;
    @Autowired DeliveryCreationService creation;
    @Autowired VerifyPaymentService verification;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired ProductRepository products;
    @Autowired OrderRepository orders;
    @Autowired com.bulkup.raptor.payment.application.service.PaidCancellationSettlementService settlement;
    @Autowired PaymentRepository payments;
    @Autowired DeliveryStatusHistoryRepository history;
    @Autowired StockReservationService stock;
    @Autowired EntityManager em;
    @Autowired TransactionTemplate tx;
    @Autowired WebApplicationContext context;
    @MockitoBean PortOnePaymentClient portone;
    final AtomicReference<RemotePayment> remote = new AtomicReference<>();
    long ownerId, otherId, adminId, productId, orderId, deliveryId;
    String paymentId;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tx.executeWithoutResult(status -> {
            var role = roles.findByCode("MEMBER").orElseThrow();
            var owner = Member.pending(UUID.randomUUID()+"@example.test", "hash", "취소 구매자", Instant.now(), role);
            owner.activateAfterEmailVerification(); members.saveAndFlush(owner); ownerId=owner.getId();
            var other = Member.pending(UUID.randomUUID()+"@example.test", "hash", "다른 구매자", Instant.now(), role);
            other.activateAfterEmailVerification(); members.saveAndFlush(other); otherId=other.getId();
            var admin = Member.pending(UUID.randomUUID()+"@example.test", "hash", "취소 관리자", Instant.now(),
                    roles.findByCode("ADMIN").orElseThrow());
            admin.activateAfterEmailVerification(); members.saveAndFlush(admin); adminId=admin.getId();
            var product = products.saveAndFlush(Product.create("취소 검증", "설명", 1000, ProductCategory.SNACK, null, "", 10));
            productId=product.getId();
            var order = Order.create(owner, UUID.randomUUID(), "cancel-test", "수령인", "01012345678", "12345", "주소", "101호");
            order.addItem(product,2); order.calculateShipping(); orders.saveAndFlush(order); orderId=order.getId();
            stock.prepare(order,false);
            var payment=payments.saveAndFlush(Payment.ready(order)); paymentId=payment.getPaymentId();
            stock.confirm(order); order.markPaid(); payment.markPaid(Instant.now(),"tx-cancel","pg-cancel","KAKAOPAY");
            deliveryId=creation.ensureForPaidOrder(orderId).getId();
        });
        remote.set(payment("PAID",0));
        when(portone.matchesConfiguration(any())).thenReturn(true);
        when(portone.find(paymentId)).thenAnswer(i -> remote.get());
        doAnswer(i -> { remote.set(payment("CANCELLED",5000)); return null; }).when(portone).cancel(paymentId,5000);
    }

    RemotePayment payment(String status,long cancelled) {
        return new RemotePayment(paymentId,"store","channel",status,5000,"KRW",Instant.now(),"tx-cancel","pg-cancel","KAKAOPAY",cancelled);
    }
    String path() { return "/api/orders/"+orderId+"/payments/cancel"; }
    RequestPostProcessor auth(long id, String... authorities) {
        return tx.execute(status -> {
            var member=members.findById(id).orElseThrow();
            var states=new HashMap<Long,RoleState>();
            member.getRoles().forEach(role -> states.put(role.getId(),new RoleState(role.getCode(),role.getPermissionVersion())));
            var token=new UsernamePasswordAuthenticationToken(id,null,Arrays.stream(authorities)
                .map(org.springframework.security.core.authority.SimpleGrantedAuthority::new).toList());
            token.setDetails(new MemberSessionDetails(member.getSessionVersion(),states));
            return authentication(token);
        });
    }
    void dispatch() { shipping.changeStatus(ownerId,deliveryId,new ChangeDeliveryStatusRequest(DeliveryStatus.OUT_FOR_DELIVERY,0L,null)); }
    void assertConflict(Runnable action,ErrorCode code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class,e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }
    long refunds() {
        return tx.execute(status -> ((Number)em.createNativeQuery("select count(*) from stock_adjustments where order_id=:id and cause='ORDER_CANCELLATION'")
            .setParameter("id",orderId).getSingleResult()).longValue());
    }
    @AfterEach void cleanup() {
        tx.executeWithoutResult(status -> {
            for (String table:List.of("stock_adjustments","stock_reservations","payments","deliveries","order_items"))
                em.createNativeQuery("delete from "+table+" where order_id=:id").setParameter("id",orderId).executeUpdate();
            orders.deleteById(orderId); orders.flush(); products.deleteById(productId); products.flush();
            members.deleteAllById(List.of(ownerId,otherId,adminId));
        });
    }

    String adminPath() { return "/api/admin/orders/"+orderId+"/cancel"; }

    @Test void bulkCancelContinuesAfterOneOrderFailsAndStoresTheReasonOnlyWhenPresent() throws Exception {
        mvc.perform(post("/api/admin/orders/cancellations")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/orders/cancellations").with(auth(adminId))
                .contentType("application/json").content("{\"orderIds\":[" + orderId + "]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/orders/cancellations").with(auth(adminId, "ORDER_MANAGE"))
                .contentType("application/json").content("{\"orderIds\":[]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        mvc.perform(post("/api/admin/orders/cancellations").with(auth(adminId, "ORDER_MANAGE"))
                .contentType("application/json").content("{\"orderIds\":[" + orderId + "," + orderId + "]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        var tooMany = new StringBuilder("{\"orderIds\":[");
        for (int i = 1; i <= 51; i++) tooMany.append(i == 1 ? "" : ",").append(i);
        tooMany.append("]}");
        mvc.perform(post("/api/admin/orders/cancellations").with(auth(adminId, "ORDER_MANAGE"))
                .contentType("application/json").content(tooMany.toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        verifyNoInteractions(portone);

        mvc.perform(post("/api/admin/orders/cancellations").with(auth(adminId, "ORDER_MANAGE"))
                .contentType("application/json")
                .content("{\"orderIds\":[900000000000," + orderId + "],\"reason\":\"  재고 오류  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].orderId").value(900000000000L))
                .andExpect(jsonPath("$.results[0].succeeded").value(false))
                .andExpect(jsonPath("$.results[0].code").value("ORDER_NOT_FOUND"))
                .andExpect(jsonPath("$.results[1].orderId").value(orderId))
                .andExpect(jsonPath("$.results[1].succeeded").value(true))
                .andExpect(jsonPath("$.results[1].orderStatus").value("CANCELLED"));
        assertThat(query.get(ownerId, orderId).cancellationReason()).isEqualTo("재고 오류");
        verify(portone, times(1)).cancel(paymentId, 5000);
    }

    @Test void adminCancelStoresReasonOnTheOrder() throws Exception {
        mvc.perform(post(adminPath()).with(auth(adminId,"ORDER_MANAGE"))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"재고 오류\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.orderStatus").value("CANCELLED"));
        assertThat(query.get(ownerId,orderId).status()).isEqualTo("CANCELLED");
        assertThat(query.get(ownerId,orderId).cancellationReason()).isEqualTo("재고 오류");
    }

    @Test void adminCancelRejectedAfterDispatchAndRequiresOrderManage() throws Exception {
        mvc.perform(post(adminPath())).andExpect(status().isUnauthorized());
        mvc.perform(post(adminPath()).with(auth(adminId))).andExpect(status().isForbidden());
        mvc.perform(post(adminPath()).with(auth(ownerId,"MENU_ADMIN_ACCESS"))).andExpect(status().isForbidden());
        dispatch();
        mvc.perform(post(adminPath()).with(auth(adminId,"ORDER_MANAGE")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_CANCELLATION_IN_TRANSIT"));
        verifyNoInteractions(portone);
    }

    @Test void preparingOrderRefundsOnceAndCannotBeDispatched() throws Exception {
        assertThat(query.get(ownerId,orderId).deliveryStatus()).isEqualTo("PREPARING");
        mvc.perform(post(path()).with(auth(ownerId))).andExpect(status().isOk())
            .andExpect(jsonPath("$.orderStatus").value("CANCELLED")).andExpect(jsonPath("$.pending").value(false));
        assertThat(cancellation.cancel(ownerId,orderId).orderStatus()).isEqualTo("CANCELLED");
        verify(portone,times(1)).cancel(paymentId,5000);
        assertThat(products.findById(productId).orElseThrow().getStockQuantity()).isEqualTo(10);
        assertThat(products.findById(productId).orElseThrow().getReservedQuantity()).isZero();
        assertThat(refunds()).isEqualTo(1);
        assertThat(payments.findById(paymentId).orElseThrow().getStatus()).isEqualTo(PaymentStatus.CANCELLED);
        assertConflict(this::dispatch,ErrorCode.DELIVERY_ORDER_NOT_PAID);
        assertThat(history.findByDeliveryIdOrderByCreatedAtAscIdAsc(deliveryId)).isEmpty();
    }

    @Test void shippingAndDeliveredRejectCancellationBeforeProviderCall() throws Exception {
        dispatch();
        mvc.perform(post(path()).with(auth(ownerId))).andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ORDER_CANCELLATION_IN_TRANSIT"));
        shipping.changeStatus(ownerId,deliveryId,new ChangeDeliveryStatusRequest(DeliveryStatus.DELIVERED,1L,null));
        mvc.perform(post(path()).with(auth(ownerId))).andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ORDER_CANCELLATION_DELIVERED"));
        verifyNoInteractions(portone);
        assertThat(query.get(ownerId,orderId).cancellationReason()).isNull();
        assertThat(refunds()).isZero();
    }

    @Test void requiresAuthenticationAndOwnerBeforeRemoteLookup() throws Exception {
        mvc.perform(post(path())).andExpect(status().isUnauthorized());
        mvc.perform(post(path()).with(auth(otherId))).andExpect(status().isNotFound());
        verifyNoInteractions(portone);
    }

    @Test void lostRemoteResponseKeepsShippingBlockedAndRetrySettlesOnlyOnce() throws Exception {
        doAnswer(i -> {remote.set(payment("CANCELLED",5000)); throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);})
            .when(portone).cancel(paymentId,5000);
        mvc.perform(post(path()).with(auth(ownerId))).andExpect(status().isAccepted())
            .andExpect(jsonPath("$.orderStatus").value("PAID")).andExpect(jsonPath("$.pending").value(true));
        assertThat(query.get(ownerId,orderId).cancellationPending()).isTrue();
        assertThat(query.list(ownerId,0,20,null).content().getFirst().cancellationPending()).isTrue();
        assertConflict(this::dispatch,ErrorCode.DELIVERY_CANCELLATION_PENDING);
        assertThat(refunds()).isZero();
        assertThat(cancellation.cancel(ownerId,orderId).orderStatus()).isEqualTo("CANCELLED");
        verify(portone,times(1)).cancel(paymentId,5000);
        assertThat(refunds()).isEqualTo(1);
    }

    @Test void pendingRemoteCancellationDoesNotClaimSuccessOrRestoreStock() {
        doNothing().when(portone).cancel(paymentId,5000);
        assertThat(cancellation.cancel(ownerId,orderId).pending()).isTrue();
        assertThat(products.findById(productId).orElseThrow().getStockQuantity()).isEqualTo(8);
        assertThat(refunds()).isZero();
        assertConflict(this::dispatch,ErrorCode.DELIVERY_CANCELLATION_PENDING);
        remote.set(payment("CANCELLED",5000));
        verification.reconcilePayment(paymentId);
        assertThat(query.get(ownerId,orderId).status()).isEqualTo("CANCELLED");
        assertThat(refunds()).isEqualTo(1);
    }

    @Test void stalePaidWebhookCannotResurrectACancelledOrder() {
        cancellation.cancel(ownerId,orderId);
        remote.set(payment("PAID",0));
        verification.verifyWebhook(paymentId);
        assertThat(query.get(ownerId,orderId).status()).isEqualTo("CANCELLED");
        assertThat(refunds()).isEqualTo(1);
    }

    @Test void mismatchedProviderPaymentNeverTriggersRefund() {
        remote.set(new RemotePayment(paymentId,"store","channel","PAID",4999,"KRW",Instant.now(),"tx","pg","KAKAOPAY",0));
        assertConflict(() -> cancellation.cancel(ownerId,orderId),ErrorCode.PAYMENT_VERIFICATION_MISMATCH);
        verify(portone,never()).cancel(anyString(),anyLong());
        assertThat(query.get(ownerId,orderId).cancellationPending()).isTrue();
    }

    @Test void cancellationBlocksDispatchWhileExternalCallIsInFlight() throws Exception {
        var reached=new CountDownLatch(1); var release=new CountDownLatch(1);
        doAnswer(i -> {reached.countDown(); assertThat(release.await(10,TimeUnit.SECONDS)).isTrue(); remote.set(payment("CANCELLED",5000)); return null;})
            .when(portone).cancel(paymentId,5000);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var cancel=pool.submit(() -> cancellation.cancel(ownerId,orderId));
            try {
                assertThat(reached.await(10,TimeUnit.SECONDS)).isTrue();
                assertConflict(this::dispatch,ErrorCode.DELIVERY_CANCELLATION_PENDING);
            } finally {release.countDown();}
            assertThat(cancel.get(15,TimeUnit.SECONDS).orderStatus()).isEqualTo("CANCELLED");
        }
    }

    @Test void concurrentCancellationRetriesRestoreStockOnlyOnce() throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(4)) {
            var tasks=new ArrayList<Future<String>>();
            for(int i=0;i<4;i++) tasks.add(pool.submit(() -> {start.await(); return cancellation.cancel(ownerId,orderId).orderStatus();}));
            start.countDown();
            for(var task:tasks) assertThat(task.get(20,TimeUnit.SECONDS)).isEqualTo("CANCELLED");
        }
        assertThat(refunds()).isEqualTo(1);
        assertThat(products.findById(productId).orElseThrow().getStockQuantity()).isEqualTo(10);
        assertThat(history.findByDeliveryIdOrderByCreatedAtAscIdAsc(deliveryId)).isEmpty();
    }

    @Test void storesTrimmedReasonOnTheCancelledOrder() throws Exception {
        mvc.perform(post(path()).with(auth(ownerId)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"  중복 주문  \"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/orders/"+orderId).with(auth(ownerId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationReason").value("중복 주문"));
    }

    @Test void rejectsTooLongReasonBeforeChangingTheOrder() throws Exception {
        mvc.perform(post(path()).with(auth(ownerId)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"reason\":\""+"x".repeat(201)+"\"}"))
                .andExpect(status().isBadRequest());
        assertThat(query.get(ownerId,orderId).cancellationReason()).isNull();
        assertThat(query.get(ownerId,orderId).status()).isEqualTo("PAID");
        verifyNoInteractions(portone);
    }

    @Test void retriesPreserveFirstReason() {
        cancellation.cancel(ownerId,orderId,"첫 사유");
        cancellation.cancel(ownerId,orderId,"바뀐 사유");
        assertThat(query.get(ownerId,orderId).cancellationReason()).isEqualTo("첫 사유");
        assertThat(query.get(ownerId,orderId).status()).isEqualTo("CANCELLED");
    }

    @Test void providerOutageKeepsTheReasonUntilTheRetryCompletes() {
        when(portone.find(paymentId)).thenThrow(new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE))
                .thenThrow(new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE)).thenAnswer(i -> remote.get());
        assertThat(cancellation.cancel(ownerId,orderId,"자동 재처리 검증").pending()).isTrue();
        assertThat(query.get(ownerId,orderId).cancellationReason()).isEqualTo("자동 재처리 검증");
        assertThat(cancellation.cancel(ownerId,orderId).pending()).isTrue();
        assertThat(cancellation.cancel(ownerId,orderId).orderStatus()).isEqualTo("CANCELLED");
        assertThat(query.get(ownerId,orderId).cancellationReason()).isEqualTo("자동 재처리 검증");
    }

    @Test void cancelledSettlementRollsBackWithOrderPaymentAndInventory() {
        assertThatThrownBy(() -> tx.execute(status -> {
            var order=orders.findByIdForUpdate(orderId).orElseThrow();
            order.rememberCancellationReason("롤백 검증");
            order.requestPaidCancellation();
            settlement.complete(order,payments.findById(paymentId).orElseThrow(),payment("CANCELLED",5000));
            throw new IllegalStateException("rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(query.get(ownerId,orderId).cancellationReason()).isNull();
        assertThat(query.get(ownerId,orderId).status()).isEqualTo("PAID");
        assertThat(products.findById(productId).orElseThrow().getStockQuantity()).isEqualTo(8);
        assertThat(payments.findById(paymentId).orElseThrow().getStatus()).isEqualTo(PaymentStatus.PAID);
    }

    @Test void simultaneousDispatchAndCancelCannotBothSucceed() throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var cancel=pool.submit(() -> {start.await(); try {return cancellation.cancel(ownerId,orderId).orderStatus().equals("CANCELLED");} catch(BusinessException e) {assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ORDER_CANCELLATION_IN_TRANSIT); return false;}});
            var dispatch=pool.submit(() -> {start.await(); try {dispatch(); return true;} catch(BusinessException e) {assertThat(e.getErrorCode()).isIn(ErrorCode.DELIVERY_CANCELLATION_PENDING,ErrorCode.DELIVERY_ORDER_NOT_PAID); return false;}});
            start.countDown();
            boolean cancelled=cancel.get(20,TimeUnit.SECONDS), shipped=dispatch.get(20,TimeUnit.SECONDS);
            assertThat(cancelled ^ shipped).isTrue();
            assertThat(refunds()).isEqualTo(cancelled?1:0);
            assertThat(history.findByDeliveryIdOrderByCreatedAtAscIdAsc(deliveryId)).hasSize(shipped?1:0);
        }
    }
}
