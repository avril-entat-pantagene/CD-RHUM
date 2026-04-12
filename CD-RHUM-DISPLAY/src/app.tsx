import { BouncingCdRhumLogo } from './components/BouncingCdRhumLogo'
import { PricesList } from "./components/Priceslist";

export function App() {
  return (
    <>
      <section id="top-section" class="border h-15">
        <BouncingCdRhumLogo />
      </section>

      {/* <section id="logs" class="border">
        <div>
          logs
        </div>
      </section> */}

      <section id="prices" class="h-80">
        <PricesList />

      </section>


    </>
  )
}
