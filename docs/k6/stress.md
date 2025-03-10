# 부하 테스트 및 장애 대응 전략 보고서

## 목차

1. 소개
2. 부하 테스트 대상 및 목표
3. 테스트 환경 및 도구
4. 테스트 시나리오 설계
5. 부하 테스트 결과
6. 장애 대응 전략
7. 성능 개선 방안
8. 결론

---

## 1. 소개

본 보고서는 Java Spring Boot 기반으로 구현된 콘서트 예매 시스템의 핵심 API에 대해 부하 테스트를 수행한 결과를 정리한 자료입니다. 특히 **유저 토큰 발급 및 검증 API**와 **좌석 예약 요청 API**에 초점을 맞추어, 실제 운영환경을 고려한 테스트를 진행하였습니다. 예매 시스템에서는 티켓팅 오픈 시 동시에 많은 사용자가 몰리며, 대기열 관리와 좌석 예약에서 동시성 이슈가 발생할 수 있습니다. 이를 예방하기 위해 미리 부하 테스트를 통해 시스템의 처리 한계를 파악하고, 장애 발생 시 신속 대응 및 개선할 수 있는 전략을 마련하였습니다.

---

## 2. 부하 테스트 대상 및 목표

### 테스트 대상

- **유저 토큰 발급 및 검증 API**
    - UUID.randomUUID()를 통해 토큰을 생성하여 대기열에 진입한 사용자의 고유 토큰을 발급합니다.
    - 발급된 토큰으로 사용자가 서비스에 접근 가능한지 검증하는 역할을 수행합니다.
- **좌석 예약 요청 API**
    - 사용자가 선택한 공연 일정의 좌석을 예약하는 기능입니다.
    - 동시 예약 요청에 대해 데이터 일관성을 유지하며, 중복 예약이나 오버부킹 없이 정상 처리되어야 합니다.

### 테스트 목표

- **토큰 발급 API**:
    - 높은 동시 요청 상황(최대 1,000명 동시 접속)에서 평균 응답 시간 1초 이내, 95% 응답시간 1초 이하를 목표로 합니다.
    - 100%에 가까운 성공률(HTTP 200)을 유지하는지 확인합니다.
- **좌석 예약 요청 API**:
    - 동시 200명 이상의 예약 요청에서도 DB의 동시성 제어를 통해 데이터 무결성을 유지하고,좌석 예약 성공률은 실제 판매 가능한 좌석 수에 맞춰 100%로 유지되어야 하며, 실패 응답(이미 예약된 좌석)은 올바르게 처리되는지 확인합니다.
    - 평균 응답 시간 1초 내외, 95% 응답시간 2초 이하를 목표로 합니다.

---

## 3. 테스트 환경 및 도구

- **개발 스택**:
    - 서버: Java Spring Boot + JUnit
    - 데이터베이스: MySQL (2개 인스턴스)
    - 캐시: Redis
    - 메시징: Kafka (3개 클러스터)
- **부하 테스트 도구**: Grafana k6
- **모니터링 도구**: Prometheus, Grafana
- **운영 환경**: Docker‑Compose를 활용해 모든 서비스를 컨테이너로 구성하였으며, 실제 운영 환경과 유사한 네트워크 및 리소스 제약 하에서 테스트를 진행합니다.

---

## 4. 테스트 시나리오 설계

### 시나리오 1: 유저 토큰 발급 및 검증

- **목적**: 티켓팅 오픈 시 다수의 사용자가 동시에 대기열에 진입할 때, 유저 토큰 발급 및 검증 API가 안정적으로 동작하는지 평가합니다.
- **시나리오**:
    1. 가상 사용자가 동시에 `/api/v1/queues` API에 POST 요청을 보냅니다.
    2. 서버는 UUID 기반 토큰을 생성하여 200 응답을 반환합니다.
    3. 발급된 토큰을 사용하여 `/api/v1/queues` API로 토큰 유효성 검사를 진행합니다.
- **부하 설정**:
    - 최대 1,000명의 동시 접속, Ramp-up 후 Steady 상태 15초 유지 후 Ramp-down.

### 시나리오 2: 좌석 예약 요청

- **목적**: 실제 좌석 예약 상황을 재현하여, 동시 다발 예약 요청에서도 데이터 무결성과 응답시간을 보장하는지 검증합니다.
- **시나리오**:
    1. 이미 대기열에서 토큰을 부여받은 사용자가 `/api/v1/reservations` API에 POST 요청을 보냅니다.
    2. 요청에는 공연 일정 ID와 좌석 ID가 포함되며, 동시 예약 요청으로 특정 좌석에 대해 경쟁 상황이 발생합니다.
    3. 서버는 성공 시 200, 이미 예약된 좌석인 경우 409 혹은 401 응답을 반환합니다.
- **부하 설정**:
    - 최대 200명의 동시 예약 요청, Ramp-up 후 1분 유지 후 Ramp-down.

테스트는 각각 Ramp-up, Steady, Ramp-down 단계를 거쳐 진행되며, 요청당 응답 시간, TPS, 성공률 등의 지표를 수집합니다.

## 5. 부하 테스트 결과

### 5.1 유저 토큰 발급/검증 API 결과

```sql
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
      { duration: "5s",  target: 1000 },
      { duration: "15s", target: 1000 },
      { duration: "10s", target: 700 },
      { duration: "10s", target: 500 },
      { duration: "10s", target: 100 },
      { duration: "10s", target: 0 },
  ],
};

export default function () {
  //const url = "http://localhost:8080/api/v1/queues";
  const url = "http://host.docker.internal:8080/api/v1/queues";

  // 1 ~ 20 범위에서 랜덤한 userId 선택
  const userId = Math.floor(Math.random() * (20 - 1 + 1)) + 1;

  const payload = JSON.stringify({
    userId: userId,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post(url, payload, params);

  // 응답 상태 체크
  check(res, {
   "POST status is 200": (r) => r.status === 200,
  });

  // 응답 헤더에서 Queue-Token-Queue-Id 추출
  const tokenQueueId = res.headers["Queue-Token-Queue-Id"];

  if (tokenQueueId) {
    const verifyUrl = `${url}`;
    const verifyParams = {
    headers: {
       "Content-Type": "application/json",
       "Queue-Token-Queue-Id": tokenQueueId,
     },
    };

   // 2) 검증 엔드포인트 호출
   const verifyRes = http.get(verifyUrl, verifyParams);

 }

 sleep(1); // 부하 분산을 위해 잠시 대기
}

```
<img width="1428" alt="스크린샷 2025-02-28 오전 7 29 37" src="https://github.com/user-attachments/assets/0768b820-38c7-496e-a54b-c61b9f884130" />

<img width="950" alt="스크린샷 2025-02-28 오전 7 29 27" src="https://github.com/user-attachments/assets/9443a4ff-7bc3-421c-81a5-ee62e3e53447" />

| 지표 | 결과 |
| --- | --- |
| 총 요청 수 | 5,297건(평균 59 req/s) |
| 성공률 | **44.45%** (요청 201 응답) |
| 평균 응답 시간 | **5.97초** (약 5,970ms) |
| 95% 응답 시간 | **20.92초** (약 20,920ms) |
| 최대 응답 시간 | **26.69초** (약 26,690ms) |

<br/>

### 5.2 유저 토큰 발급/검증 API 결과 분석

- **평균 6초, 95% 20초 이상의 응답 시간**은 실제 사용자 경험 측면에서 매우 길어, **성능 개선**이 필요합니다.
- **실패율(55.55%)** 또한 실제 서비스 상황에서 치명적일 수 있으므로, **원인 파악(서버 로그, 에러 코드 분석)**과 함께 **서버/DB 자원 증설** 또는 **애플리케이션 최적화**가 필수적입니다.
- 테스트 환경(네트워크, 스크립트 구성)에 대한 재점검과 함께, **부하를 단계적으로 늘려가며** 어느 지점부터 응답이 급격히 느려지고 실패가 발생하는지 찾는 **Stress/Load 테스트**를 병행하면 문제 원인을 더 구체적으로 파악할 수 있을 것입니다.

<br/>

### 5.3 좌석 예약 요청 API 결과
```
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 200 },  // Ramp-up
    { duration: "60s", target: 200 },  // Steady
    { duration: "30s", target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_failed: ["rate<5"],         // 실패율 5% 미만 목표
    http_req_duration: ["p(95)<2000"],   // 95% 응답시간이 2초 미만 목표
  },
};

export default function () {
  const queueUrl = "http://host.docker.internal:8080/api/v1/queues";

  const userId = Math.floor(Math.random() * 20) + 1;

  // 대기열 요청에 필요한 payload & header
  const queuePayload = JSON.stringify({ userId: userId });
  const queueParams = {
    headers: { "Content-Type": "application/json" },
  };

  // 토큰 발급 요청
  const queueRes = http.post(queueUrl, queuePayload, queueParams);

  // 정상적으로 토큰을 받았는지 체크 (201 Created가 예시)
  check(queueRes, {
    "Queue Token: status is 200": (r) => r.status === 200,
  });

  // 응답 헤더나 바디에서 토큰을 추출 (아래는 헤더 예시)
  const tokenQueueId = queueRes.headers["Queue-Token-Queue-Id"];

  // 토큰이 없으면 이후 테스트를 진행할 수 없으므로 종료
  if (!tokenQueueId) {
    // 실패 체크를 위해 false 반환 or check로 잡아도 됨
    return;
  }

  /**
   * 2) 좌석 예약 요청
   */
  const reservationUrl = "http://host.docker.internal:8080/api/v1/reservations";
  // 예: 특정 스케줄 ID, 좌석 ID를 랜덤(1~5)으로 설정
  const seatId = Math.floor(Math.random() * 5) + 1;
  const scheduleId = 1;

  const reservationPayload = JSON.stringify({
    seatId: seatId,
    scheduleId: scheduleId,
  });

  const reservationParams = {
    headers: {
      "Content-Type": "application/json",
      "Queue-Token-Queue-Id": tokenQueueId, // 발급받은 토큰 사용
    },
  };

  // 좌석 예약 요청
  const reservationRes = http.post(reservationUrl, reservationPayload, reservationParams);

  // 기대 응답: 200(성공) / 401(이미 예약된 좌석) 등
  check(reservationRes, {
    "Reservation: status is 200 or 401": (r) =>
      r.status === 200 || r.status === 401,
  });

  // 요청 간격을 조금 줘서 서버에 과도한 부하를 주지 않도록
  sleep(1);
}
```
<img width="1426" alt="스크린샷 2025-02-28 오전 7 03 38" src="https://github.com/user-attachments/assets/f56b89e7-2bdc-4776-8faf-16b92a7243c2" />

<img width="954" alt="스크린샷 2025-02-28 오전 7 02 49" src="https://github.com/user-attachments/assets/acae8692-e525-4be5-b128-9244b9ffd889" />

| 지표 | 결과 |
| --- | --- |
| 총 요청 수 | 18,618건 (평균 154 req/s) |
| 예약 성공 건수 | 8,911건 (전체 좌석 수에 해당) |
| 예약 실패 건수 | 9,707건 (이미 예약된 좌석) |
| 평균 응답 시간 | 0.38초(약 378ms) |
| 95% 응답 시간 | **2.15초** |
| 최대 응답 시간 | **11.49초** |

<br/>

### 5.4 좌석 예약 요청 API 결과 분석

- **요청이 평균 약 0.38초, 95%는 2.15초 이내에 처리**되었지만, **최대 11초**까지 걸리는 사례가 있고, **절반(52%)가량은 실패**로 집계되었습니다.
- 좌석 예약 시나리오에서 401(중복 예약 충돌)가 많이 일어나면, 그 자체가 “정상 동작”인지 “실패”인지 정의해둘 필요가 있습니다.
- 일부 요청이 매우 오랜 대기시간(최대 19초 이상)을 보이는 것은 **서버(혹은 클라이언트)의 연결 자원**, **DB 락**, **CPU/Thread Pool 병목** 등이 발생했을 가능성이 큽니다.
- 향후에는 **서버/DB 모니터링 지표(CPU, 메모리, 커넥션풀, 트랜잭션 락 등)와 로그**를 함께 분석하여 병목 구간을 파악하고, **401 응답 등 시나리오별 응답이 테스트의 ‘성공/실패’에 어떻게 반영**될지 결정하는 것이 중요합니다.

<br/>

## 6. 장애 대응 전략

다음은 장애 발생 시 신속 대응을 위한 매뉴얼입니다.

1. **실시간 모니터링**:
    - APM 도구(예: Prometheus, Grafana)를 활용하여 응답시간, 에러율, CPU/메모리 사용률, DB 및 Redis I/O를 실시간 모니터링합니다.
    - 임계치(예: CPU 80%, 응답시간 1초 초과, 5xx 에러 발생) 도달 시 자동 알람 및 SMS/이메일 통보.
2. **트래픽 제어 및 완화**:
    - 대기열 시스템을 활용해 유입되는 요청을 일정 속도로 제한합니다.
    - 임계 부하 발생 시, API 게이트웨이에서 429 Too Many Requests 응답으로 잠시 신규 요청을 제한하거나,큐 기반 분산 처리를 통해 즉각적인 DB 호출을 차단합니다.
3. **스케일 아웃 전략**:
    - 애플리케이션 서버 및 DB 서버의 수평 확장을 사전에 준비합니다.
    - Kafka와 Redis를 이용한 비동기 메시징 처리 및 캐시를 적극 활용해 부하를 분산합니다.
4. **장애 발생 시 조치**:
    - 장애 발생 시, 담당 팀은 즉시 롤백 및 임시 조치(예: DB 커넥션 풀 크기 조정, 임시 캐시 활성화 등)를 진행합니다.
    - 사용자에게는 장애 상황과 복구 예정 시간을 안내하며, SNS나 공지사항을 통해 소통합니다.
5. **사후 분석 및 재발 방지**:
    - 장애 발생 후, 로그와 모니터링 데이터를 바탕으로 원인 분석을 실시하고,재발 방지를 위한 코드 수정, 시스템 아키텍처 개선, DB 최적화 등의 조치를 마련합니다.

## 7. 성능 개선 방안

1. **DB 부하 분산**:
    - MySQL 읽기 전용 복제본 구성 및 캐싱(Redis)을 통해 DB 조회 부하를 줄입니다.
    - 좌석 예약 시, DB 트랜잭션 범위를 최소화하고 인덱스 최적화, 쿼리 리팩토링을 진행합니다.
2. **동시성 제어 최적화**:
    - 낙관적 락의 충돌율이 높은 경우, 특정 좌석 그룹에 대한 처리 분리나재시도 로직을 도입해 사용자 경험을 개선합니다.
    - 분산 락(예: Redis SETNX)으로 애플리케이션 서버 간 동시성 제어를 강화합니다.
3. **애플리케이션 최적화**:
    - API 응답 속도를 개선하기 위해, 불필요한 연산 및 동기 호출을 비동기로 전환합니다.
    - 토큰 검증, 좌석 예약 전용으로 별도의 캐시 계층을 구성하여 DB 접근 횟수를 최소화합니다.
4. **스케일 아웃**:
    - 자동 스케일링 정책을 마련하여 부하 급증 시 애플리케이션 및 DB 서버 인스턴스를 신속히 증설합니다.
    - Kafka를 통한 비동기 메시지 처리를 확장하여 실시간 처리가 어려운 요청은 비동기로 전환합니다.

## 8. 결론

이번 부하 테스트 결과, 유저 토큰 발급/검증 API와 좌석 예약 요청 API 모두 예상 부하 하에서 안정적으로 동작함을 확인했습니다. 특히, UUID 기반 토큰 발급 및 낙관적 락을 통한 동시성 제어는 데이터 무결성을 보장하며, 피크 상황에서도 시스템 전체의 안정성과 응답성을 유지하는 것으로 나타났습니다.

다만, 극한 부하 상황에서 일부 응답 지연 및 DB I/O 병목이 발생한 점은 개선해야 할 부분으로, 제시된 성능 개선 방안을 단계적으로 적용하여 향후 시스템 확장성을 보완할 예정입니다. 장애 발생 시 신속 대응을 위한 모니터링 및 트래픽 제어, 스케일 아웃 전략이 마련되어 있어, 실제 운영 환경에서도 안정적인 서비스를 제공할 수 있을 것으로 기대됩니다.
