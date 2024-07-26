import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib import rcParams

# 한글 폰트 설정 (Mac OS의 경우 기본적으로 설치된 AppleGothic 사용)
rcParams['font.family'] = 'AppleGothic'

# CSV 파일에서 데이터 읽기
file_path = 'data.csv'  # CSV 파일 경로
data = pd.read_csv(file_path)

# 날짜를 datetime 형식으로 변환
data['날짜'] = pd.to_datetime(data['날짜'])

# 금액 데이터
data.set_index('날짜', inplace=True)
amount = data['금액']

# 최고 금액
cum_max = amount.cummax()

# 낙폭
drawdown = (amount - cum_max) / cum_max

# 최대 낙폭(MDD)
mdd = drawdown.min()
mdd_date = drawdown.idxmin()
mdd_value = drawdown.loc[mdd_date]

# 최대 금액
max_amount = amount.max()
max_amount_date = amount.idxmax()

# 처음과 마지막 금액
initial_amount = amount.iloc[0]
final_amount = amount.iloc[-1]

# 전체 상승률(%)
percentage_change = ((final_amount - initial_amount) / initial_amount) * 100

# 금액 차트 그리기
plt.figure(figsize=(12, 8))  # 화면 크기 줄임

# 금액 차트
plt.subplot(2, 1, 1)
plt.plot(amount, label='금액')
plt.scatter(max_amount_date, max_amount, color='green', zorder=5, label=f'최대 금액: {max_amount:.2f}')
plt.title('금액 변화')
plt.legend(loc='best')

# MDD 차트
plt.subplot(2, 1, 2)
plt.plot(drawdown, label='MDD', color='red')
plt.scatter(mdd_date, mdd_value, color='blue', zorder=5, label=f'최대 낙폭 (MDD): {mdd_value:.2%}')
plt.title('Maximum Drawdown (MDD)')
plt.legend(loc='best')

# 전체 상승률 표시
plt.suptitle(f'전체 상승률: {percentage_change:.2f}%', fontsize=14)

plt.tight_layout(rect=[0, 0.03, 1, 0.95])  # Adjust layout to fit title
plt.show()
