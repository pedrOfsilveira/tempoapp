// app/index.tsx
import axios from 'axios';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// API para previsão de 5 dias / 3 horas (gratuita e funciona com a chave padrão)
const API_KEY = '3563bcf2fe6422a6655d490bf966f060'; // <<< SUBSTITUA PELA SUA CHAVE DA OPENWEATHERMAP (Funciona com a conta gratuita)
const BASE_FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const BASE_CURRENT_WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'; // Para o clima atual mais preciso

const BASE_WEATHER_ICON_URL = 'https://openweathermap.org/img/wn/';

// Interfaces para tipagem dos dados da API
interface CurrentWeatherResponse {
  name: string;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: {
    description: string;
    main: string;
    icon: string;
  }[];
  wind: {
    speed: number;
  };
}

interface ForecastListItem {
  dt: number;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
  };
  weather: {
    description: string;
    icon: string;
  }[];
  dt_txt: string; // "2025-05-24 18:00:00"
}

interface ProcessedDailyForecast {
  dt: number;
  dateString: string;
  temp: number;
  min_temp: number;
  max_temp: number;
  description: string;
  icon: string;
}

export default function Index() {
  const [city, setCity] = useState('');
  const [currentWeatherData, setCurrentWeatherData] = useState<CurrentWeatherResponse | null>(null);
  const [dailyForecastData, setDailyForecastData] = useState<ProcessedDailyForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWeather = async () => {
    if (!city) {
      setError('Por favor, digite o nome de uma cidade.');
      return;
    }
    setLoading(true);
    setError('');
    setCurrentWeatherData(null);
    setDailyForecastData([]);

    try {
      // 1. Buscar o Clima Atual
      const currentWeatherResponse = await axios.get<CurrentWeatherResponse>(BASE_CURRENT_WEATHER_URL, {
        params: {
          q: city,
          appid: API_KEY,
          units: 'metric',
          lang: 'pt_br',
        },
      });
      setCurrentWeatherData(currentWeatherResponse.data);

      // 2. Buscar a Previsão de 5 dias / 3 horas
      const forecastResponse = await axios.get<{ list: ForecastListItem[] }>(BASE_FORECAST_URL, {
        params: {
          q: city,
          appid: API_KEY,
          units: 'metric',
          lang: 'pt_br',
        },
      });

      // Processar os dados da previsão para mostrar uma entrada por dia
      const dailyAggregatedForecast: { [key: string]: ProcessedDailyForecast } = {};

      forecastResponse.data.list.forEach(item => {
        const date = new Date(item.dt * 1000); // Converter timestamp para data
        const dateString = date.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        // Se este dia ainda não foi processado ou se a hora é mais próxima do meio-dia (12-15h)
        // pegamos os dados para aquele dia.
        if (!dailyAggregatedForecast[dateString]) {
          dailyAggregatedForecast[dateString] = {
            dt: item.dt,
            dateString: dateString,
            temp: item.main.temp,
            min_temp: item.main.temp_min,
            max_temp: item.main.temp_max,
            description: item.weather[0].description,
            icon: item.weather[0].icon,
          };
        } else {
            // Atualiza min/max se encontrar extremos
            dailyAggregatedForecast[dateString].min_temp = Math.min(
                dailyAggregatedForecast[dateString].min_temp,
                item.main.temp_min
            );
            dailyAggregatedForecast[dateString].max_temp = Math.max(
                dailyAggregatedForecast[dateString].max_temp,
                item.main.temp_max
            );
            // Podemos pegar a temperatura e descrição de um horário específico, como o meio-dia ou a primeira entrada do dia
            // Para simplicidade, vamos manter a primeira entrada ou a que mais se aproximar do meio-dia.
            const existingDate = new Date(dailyAggregatedForecast[dateString].dt * 1000);
            if (Math.abs(date.getHours() - 13) < Math.abs(existingDate.getHours() - 13)) { // Tentar pegar o mais próximo das 13h
                dailyAggregatedForecast[dateString].dt = item.dt;
                dailyAggregatedForecast[dateString].temp = item.main.temp;
                dailyAggregatedForecast[dateString].description = item.weather[0].description;
                dailyAggregatedForecast[dateString].icon = item.weather[0].icon;
            }
        }
      });

      // Converte o objeto em array e ordena por data
      const sortedDailyForecast = Object.values(dailyAggregatedForecast).sort(
        (a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime()
      );

      // Filtrar para exibir apenas os próximos 3 a 5 dias (excluindo o dia atual se já tiver sido pego pelo currentWeatherData)
      // O primeiro item do sortedDailyForecast será o dia atual ou o próximo.
      // Se já temos currentWeatherData, a previsão começa do próximo dia.
      const todayString = new Date().toISOString().split('T')[0];
      const futureForecast = sortedDailyForecast.filter(
        item => item.dateString !== todayString
      ).slice(0, 4); // Mostra os próximos 4 dias além do atual

      setDailyForecastData(futureForecast);

    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 401) {
          setError(
            'Erro 401: Chave de API inválida. Verifique sua chave OpenWeatherMap.'
          );
          Alert.alert(
            'Erro de API',
            'Sua chave de API OpenWeatherMap está inválida ou não autorizada. Verifique se ela foi copiada corretamente e está ativa.'
          );
        } else if (err.response.status === 404) {
          setError('Cidade não encontrada. Verifique o nome e tente novamente.');
        } else {
          setError(`Erro ao buscar dados: ${err.response.status} - ${err.response.statusText}.`);
        }
      } else {
        setError('Ocorreu um erro de rede ou desconhecido. Tente novamente mais tarde.');
      }
      setCurrentWeatherData(null);
      setDailyForecastData([]);
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIconUrl = (iconCode: string) => {
    return `${BASE_WEATHER_ICON_URL}${iconCode}@2x.png`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('pt-BR', options);
  };

  const getWeatherConditionEmoji = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'clear':
        return '☀️ Limpo';
      case 'clouds':
        return '☁️ Nublado';
      case 'rain':
        return '🌧️ Chuva';
      case 'drizzle':
        return '💧 Chuvisco';
      case 'thunderstorm':
        return '⛈️ Tempestade';
      case 'snow':
        return '❄️ Neve';
      case 'mist':
      case 'fog':
      case 'haze':
        return '🌫️ Névoa';
      default:
        return condition;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Previsão do Tempo</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.input}
            placeholder="Digite o nome da cidade"
            placeholderTextColor="#888" // Cor do placeholder para o tema Y2K
            value={city}
            onChangeText={setCity}
            onSubmitEditing={fetchWeather}
          />
          <TouchableOpacity style={styles.button} onPress={fetchWeather}>
            <Text style={styles.buttonText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color="#000080" style={styles.loading} />}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {currentWeatherData && (
          <View style={styles.weatherCard}>
            <Text style={styles.cityName}>{currentWeatherData.name}</Text>
            <View style={styles.currentWeather}>
              {currentWeatherData.weather[0].icon && (
                <Image
                  style={styles.weatherIcon}
                  source={{ uri: getWeatherIconUrl(currentWeatherData.weather[0].icon) }}
                />
              )}
              <View>
                <Text style={styles.temperature}>{Math.round(currentWeatherData.main.temp)}°C</Text>
                <Text style={styles.description}>
                  {currentWeatherData.weather[0].description.charAt(0).toUpperCase() + currentWeatherData.weather[0].description.slice(1)}
                  {' '} {/* Espaço para o emoji */}
                  {getWeatherConditionEmoji(currentWeatherData.weather[0].main)}
                </Text>
              </View>
            </View>
            <View style={styles.detailsContainer}>
              <Text style={styles.detailText}>
                Mínima: {Math.round(currentWeatherData.main.temp_min)}°C
              </Text>
              <Text style={styles.detailText}>
                Máxima: {Math.round(currentWeatherData.main.temp_max)}°C
              </Text>
              <Text style={styles.detailText}>Umidade: {currentWeatherData.main.humidity}%</Text>
              <Text style={styles.detailText}>Vento: {currentWeatherData.wind.speed} m/s</Text>
            </View>
          </View>
        )}

        {dailyForecastData.length > 0 && (
          <View style={styles.forecastContainer}>
            <Text style={styles.forecastTitle}>Previsão para os Próximos Dias:</Text>
            {dailyForecastData.map((day, index) => (
              <View key={index} style={styles.forecastItem}>
                <Text style={styles.forecastDate}>{formatDate(day.dt)}</Text>
                {day.icon && (
                  <Image
                    style={styles.forecastIcon}
                    source={{ uri: getWeatherIconUrl(day.icon) }}
                  />
                )}
                <Text style={styles.forecastTemp}>
                  {Math.round(day.temp)}°C
                  <Text style={styles.minMaxTemp}> (Min: {Math.round(day.min_temp)}°C / Max: {Math.round(day.max_temp)}°C)</Text>
                </Text>
                <Text style={styles.forecastDescription}>
                  {day.description.charAt(0).toUpperCase() + day.description.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Cores do Windows 98:
  // Fundo principal: #C0C0C0 (cinza claro) - já estamos usando
  // Barra de título/Botões: #000080 (azul marinho)
  // Textos: #000000 (preto)
  // Bordas: #808080 (cinza médio), #FFFFFF (branco para realce)
  
  container: {
    flex: 1,
    backgroundColor: '#C0C0C0', // Fundo cinza claro
    paddingTop: 50,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', // Usando System/Roboto para simular sans-serif genérica
    fontSize: 26, // Um pouco menor para o estilo Win 98
    fontWeight: 'normal',
    color: '#000080', // Azul marinho
    marginBottom: 25,
    marginTop: 15,
    textShadowColor: 'rgba(255,255,255,0.7)', // Sombra mais proeminente para efeito "pixelado"
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0, // Sem blur para mais "pixel"
  },
  searchContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#C0C0C0', // Cinza de janelas do Win 98
    borderWidth: 1,
    borderColor: '#000000', // Borda mais escura (quase preta)
    borderTopColor: '#FFFFFF', // Borda superior clara para efeito 3D
    borderLeftColor: '#FFFFFF', // Borda esquerda clara para efeito 3D
    borderRadius: 0,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.4, // Sombra mais forte
    shadowRadius: 0,
    elevation: 3,
  },
  input: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    flex: 1,
    height: 36, // Altura padrão de inputs do Win 98
    paddingHorizontal: 8,
    fontSize: 15, // Um pouco menor
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000', // Borda do input preta
    borderTopColor: '#808080', // Efeito chanfrado inverso
    borderLeftColor: '#808080', // Efeito chanfrado inverso
    borderRadius: 0,
    color: '#000000',
  },
  button: {
    backgroundColor: '#C0C0C0', // Cor de fundo do botão (cinza)
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
    paddingHorizontal: 12, // Um pouco menos de padding
    marginLeft: 5,
    borderWidth: 1,
    borderColor: '#000000', // Borda preta
    borderTopColor: '#FFFFFF', // Efeito chanfrado para fora
    borderLeftColor: '#FFFFFF', // Efeito chanfrado para fora
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 2,
    height: 36, // Mesma altura do input
  },
  buttonText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    color: '#000000', // Texto preto no botão
    fontSize: 15,
    fontWeight: 'normal',
    textShadowColor: 'rgba(255,255,255,0.7)', // Sombra para dar destaque
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  loading: {
    marginTop: 20,
  },
  errorText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    color: '#FF0000',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  weatherCard: {
    backgroundColor: '#C0C0C0', // Cinza de janelas do Win 98
    borderRadius: 0,
    padding: 18, // Um pouco menos de padding
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 5,
    marginBottom: 25,
  },
  cityName: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 24, // Um pouco menor
    fontWeight: 'bold', // Pode manter negrito aqui
    color: '#000000', // Preto
    marginBottom: 10,
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  currentWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  weatherIcon: {
    width: 60, // Levemente menores
    height: 60,
    marginRight: 10,
  },
  temperature: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 45, // Um pouco menor
    fontWeight: 'bold',
    color: '#000000', // Preto
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  description: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 16, // Um pouco menor
    color: '#000000',
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 0,
  },
  detailsContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 5,
    paddingLeft: 10,
    backgroundColor: '#F0F0F0', // Fundo para a área de detalhes
    borderWidth: 1,
    borderColor: '#000000',
    borderBottomColor: '#FFFFFF', // Inverter o chanfrado
    borderRightColor: '#FFFFFF', // Inverter o chanfrado
    paddingVertical: 8, // Um pouco menos de padding
  },
  detailText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 15, // Um pouco menor
    color: '#000000',
    marginBottom: 3,
  },
  forecastContainer: {
    backgroundColor: '#C0C0C0', // Cinza de janelas do Win 98
    borderRadius: 0,
    padding: 15,
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 5,
  },
  forecastTitle: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 20, // Um pouco menor
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  forecastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7, // Menos padding
    borderBottomWidth: 1,
    borderBottomColor: '#A0A0A0', // Linha divisória cinza
  },
  forecastDate: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 15, // Um pouco menor
    fontWeight: 'normal',
    flex: 2,
    color: '#000000',
  },
  forecastIcon: {
    width: 35, // Menor
    height: 35, // Menor
    marginHorizontal: 8,
  },
  forecastTemp: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 17, // Um pouco menor
    fontWeight: 'bold',
    color: '#000000',
    flex: 1.2,
    textAlign: 'right',
  },
  minMaxTemp: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 11, // Menor
    fontWeight: 'normal',
    color: '#333333',
  },
  forecastDescription: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 13, // Menor
    color: '#333333',
    flex: 2,
    textAlign: 'right',
  },
});