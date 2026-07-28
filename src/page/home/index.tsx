import Bg from '../../assets/bg.png'
import Logo from '../../assets/logo.png'
import Map from '../../assets/map.png'
import Mouse from '../../assets/mouse.png'
import Congdong from '../../assets/congdong.png'
import Vongquaymayman from '../../assets/vongquaymayman.png'
const Home = () => {
  return (
    <div
      className="home-page"
      style={{ backgroundImage: `url(${Bg})` }}
    >
      <div className="home-page__logo">
        <img src={Logo} alt="logo" />
      </div>
      
    </div>
  )
}

export default Home