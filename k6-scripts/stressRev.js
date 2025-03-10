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
