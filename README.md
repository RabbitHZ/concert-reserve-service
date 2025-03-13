# 콘서트 예약 서비스 서버 구축


## 개요
콘서트 예약 서비스는 대기열 시스템을 사용하여 콘서트 좌석을 예약하고, 예약한 내역에 대해 결제를 진행하는 서비스입니다.
동시성 제어를 통해 동시 예약이나 결제 시 중복으로 처리되지 않도록 설계하였습니다.

## 프로젝트 목표
- 대기열 시스템을 구축하고, 예약 서비스는 작업가능한 유저만 수행할 수 있어야 함.
- 사용자는 좌석예약 시에 미리 충전한 잔액을 이용.
- 좌석 예약 요청시에, 결제가 이루어지지 않더라도 일정 시간동안 다른 유저가 해당 좌석에 접근할 수 없도록 힘.

## 기술 스택
### Backend
- Java 17, Spring Boot 3.1
- Spring Data JPA, Hibernate
- MySQL: 데이터베이스
- Swagger: API 문서화
- Redis: 대기열 관리 및 캐싱
- Kafka: 메세징 처리
- Docker, Docker-compose: 도커 컨테이너 및 자동화

### DevOps
- Grafana: 모니터링 및 로깅
- K6: 부하 테스트

### 기타
- Postman: API 테스트
- Mermaid: ERD 및 시퀀스 다이어그램

## 프로젝트 마일스톤
<img width="813" alt="399544394-6820a921-1b12-4f1f-b7a9-e5de158f52c8" src="https://github.com/user-attachments/assets/00503533-deb1-4f96-bcbd-37dc76aec4d1" />

## 주요 기능
### 1. 대기열 시스템
- 대기열 토큰 발급 API (POST /api/v1/queues)
- 토큰 상태 관리 (WAIT, ACTIVE, EXPIRE)
- 만료 토큰 자동 삭제 (Scheduler 활용)

### 2. 콘서트 예약 기능
- 예약 가능한 날짜 조회 API (GET /api/v1/concerts/{concertId}/schedules)
- 예약 가능한 좌석 조회 API (GET /api/v1/concerts/{concertId}/schedules/{scheduleId}/seats)
- 좌석 예약 API (POST /api/v1/reservations)
- 좌석 상태 (OCCUPIED, AVAILABLE) 관리

### 3. 결제 및 잔액 관리
- 잔액 조회 API (GET /api/v1/users/{userId}/balance)
- 잔액 충전 API (POST /api/v1/users/charge)
- 결제 처리 API (POST /api/v1/payments)
- 결제 성공 시 포인트 차감 및 예약 상태(PAID) 업데이트

## 데이터 모델 (ERD)
```mermaid
---
config:
  theme: default
---
erDiagram
    USER {
        BIGINT user_id PK "Primary Key, 사용자 ID"
        VARCHAR user_name "사용자 이름"
        DECIMAL point_Balance "포인트 잔액"
        DATETIME created_at "사용자 생성 시각"
        DATETIME updated_at "사용자 수정 시각"
    }
    POINT_HISTORY{
        BIGINT point_history_id PK "Primary Key, 포인트 내역 ID"
        BIGINT user_id FK "Foreign Key, 사용자 ID"
        BIGINT payment_id FK "Foreign Key, 결제 ID"
        DECIMAL recharge_amount "충전 금액"
        DECIMAL balance_before "충전 전 잔액"
        DECIMAL balance_after "충전 후 잔액"
        ENUM recharge_method "충전 수단(CARD/CASH)"
        DATETIME created_At "충전 생성 시간"
    }
    QUEUE {
        BIGINT queue_id PK "Primary Key, 대기열 ID"
        BIGINT User_id FK "Foreign Key, 사용자 ID"
        ENUM queue_status "대기열 상태(WAIT/ACTIVE/EXPIRE)"
        DATETIME created_at "토큰 생성 시각"
        DATETIME expired_at "토큰 만료 시각"
        DATETIME removed_at "토큰 제거 시각"
    }
    CONCERT {
        BIGINT concert_id PK "Primary Key, 콘서트 ID"
        VARCHAR concert_name "콘서트 이름"
        DATETIME created_at "콘서트 생성 시각"
        DATETIME updated_at "콘서트 수정 시각"
    }
    SCHEDULE {
        BIGINT schedule_id PK "Primary Key, 스케줄 ID"
        BIGINT concert_id FK "Foreign Key, 콘서트 ID"
        DECIMAL price "가격"
        DATETIME concert_date "콘서트 일자"
        DATETIME booking_start "예약 가능 시작 시간"
        DATETIME booking_end "예약 종료 시간"
        INT remaining_ticket "잔여 티켓 수"
        INT total_ticket "잔여 티켓 수"
        DATETIME created_at "스케줄 생성 시각"
        DATETIME updated_at "스케줄 수정 시각"
    }
    SEAT {
        BIGINT seat_id PK "Primary Key, 좌석 ID"
        BIGINT schedule_id FK "Foreign Key, 스케줄 ID"
        VARCHAR seat_number "좌석 번호"
        ENUM seat_status "좌석 상태 (OCCUPIED/AVAILABLE)"
        DECIMAL seat_price "좌석 가격"
        DATETIME created_at "좌석 생성 시각"
        DATETIME updated_at "좌석 수정 시각"
    }
    RESERVATION {
        BIGINT reservation_id PK "Primary Key, 예약 ID"
        BIGINT user_id FK "Foreign Key, 사용자 ID"
        BIGINT seat_id FK "Foreign Key, 좌석 ID"
        ENUM reservation_status "예약 상태 (PENDING/PAID/CANCELLED)"
        DECIMAL seat_price "좌석 가격"
        DATETIME created_at "예약 생성 시각"
        DATETIME expired_at "예약 만료 시각"
    }
    PAYMENT {
        BIGINT payment_id PK "Primary Key, 결제 ID"
        BIGINT reservation_id FK "Foreign Key, 예약 ID"
        VARCHAR seat_number "좌석 번호"
        VARCHAR concert_name "콘서트 이름"
        DATETIME concert_date_time "콘서트 일시"
        DECIMAL payment_amount "결제 금액"
        ENUM payment_status "결제 상태 (COMPLETED/FAILED/CANCELLED)"
        DATETIME created_at "결제 생성 시각"
    }
    USER ||--o{ QUEUE : "1:N"
    USER ||--o{ POINT_HISTORY : "1:N"
    CONCERT ||--o{ SCHEDULE : "1:N"
    SCHEDULE ||--o{ SEAT : "1:N"
    SEAT ||--o{ RESERVATION : "1:N"
    RESERVATION ||--o{ PAYMENT : "1:N"
    USER ||--o{ RESERVATION : "1:N"
    PAYMENT ||--o{ POINT_HISTORY : "1:N"
```

## API 문서 (Swagger)
### Swagger: [API 명세서](https://github.com/RabbitHZ/concert-reserve-service/blob/master/docs/API/API_%EB%AA%85%EC%84%B8.md)
![swagger_초안](https://github.com/user-attachments/assets/66324070-b637-40cd-934b-8db6993eb919)


## 리팩토링 및 성능 개선

- 동시성 제어 방식 분석: [분석 보고서](https://github.com/RabbitHZ/concert-reserve-service/blob/master/docs/concurrency-controll/%EB%8F%99%EC%8B%9C%EC%84%B1%EC%A0%9C%EC%96%B4_%EB%B6%84%EC%84%9D_%EB%B3%B4%EA%B3%A0%EC%84%9C.md)
- Redis를 활용한 캐싱 최적화: [성능 최적화 보고서](https://github.com/RabbitHZ/concert-reserve-service/blob/master/docs/redis-optimization/%EB%A0%88%EB%94%94%EC%8A%A4_%EC%84%B1%EB%8A%A5_%EC%B5%9C%EC%A0%81%ED%99%94.md)
- DB Index 성능 개선: [DB 성능 개선 보고서](https://github.com/RabbitHZ/concert-reserve-service/blob/STEP19/docs/index/DB_INDEX_%EC%BF%BC%EB%A6%AC_%EC%84%B1%EB%8A%A5_%EA%B0%9C%EC%84%A0_%EB%B3%B4%EA%B3%A0%EC%84%9C.md#db-index-%EC%BF%BC%EB%A6%AC-%EC%84%B1%EB%8A%A5-%EA%B0%9C%EC%84%A0-%EB%B3%B4%EA%B3%A0%EC%84%9C)
- MSA 전환 및 트랜잭션 분리 설계: [MSA 보고서](https://github.com/RabbitHZ/concert-reserve-service/blob/master/docs/msa/MSA_%EC%A0%84%ED%99%98_%EB%B0%8F_%ED%8A%B8%EB%9E%9C%EC%9E%AD%EC%85%98_%EB%B6%84%EB%A6%AC_%EB%B3%B4%EA%B3%A0%EC%84%9C.md)
- 부하 테스트 및 장애 대응 전략: [K6 부하 테스트](https://github.com/RabbitHZ/concert-reserve-service/blob/master/docs/k6/stress.md)

## 프로젝트 실행 방법 
1. 프로젝트 클론
```
git clone https://github.com/hwajinkim/consert-reserv-service.git
cd consert-reserv-service
```
2. Docker Compose 실행
```
docker-compose up -d
```
3. API 테스트
- Postman: Postman Collection




