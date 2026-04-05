import * as THREE from 'three'

export class NightSky extends THREE.Group {
  private stars: THREE.Points
  private planets: THREE.Group
  private constellations: THREE.LineSegments

  constructor() {
    super()

    // 1. Stars (Parallax Layer 1 - Slowest)
    const starGeo = new THREE.BufferGeometry()
    const starCoords: number[] = []
    const starColors: number[] = []
    const color = new THREE.Color()

    for(let i = 0; i < 4000; i++) {
      const r = 400 + Math.random() * 200
      const theta = 2 * Math.PI * Math.random()
      const phi = Math.acos(2 * Math.random() - 1)
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)
      
      starCoords.push(x, y, z)

      // Random fantasy colors (Sapphire, Gold, Purple, White)
      color.setHSL(Math.random() > 0.5 ? 0.6 : Math.random(), Math.random() * 0.8, Math.random() * 0.5 + 0.5)
      starColors.push(color.r, color.g, color.b)
    }
    
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3))
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3))
    
    const starMat = new THREE.PointsMaterial({
      size: 2.0,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
      fog: false
    })
    
    this.stars = new THREE.Points(starGeo, starMat)
    this.add(this.stars)

    // 2. Planets (Parallax Layer 2 - Faster)
    this.planets = new THREE.Group()
    
    const planetTypes = [
      { color: 0xff6644, size: 8, dist: 350, ring: false }, // Crimson giant
      { color: 0x44aaff, size: 10, dist: 300, ring: true }, // Frost blue with rings
      { color: 0xaa22ff, size: 5, dist: 380, ring: false }, // Deep purple
      { color: 0x22ff88, size: 4, dist: 320, ring: true }   // Jade
    ]

    planetTypes.forEach(pData => {
      const pGroup = new THREE.Group()
      
      const pGeo = new THREE.SphereGeometry(pData.size * 3, 32, 32)
      const pMat = new THREE.MeshBasicMaterial({ color: pData.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false })
      const pMesh = new THREE.Mesh(pGeo, pMat)
      
      if (pData.ring) {
        const rGeo = new THREE.RingGeometry(pData.size * 5.0, pData.size * 8.0, 64)
        const rMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })
        const rMesh = new THREE.Mesh(rGeo, rMat)
        rMesh.rotation.x = Math.PI / 2.5
        pGroup.add(rMesh)
      }
      
      pGroup.add(pMesh)
      
      const theta = 2 * Math.PI * Math.random()
      const phi = (Math.random() - 0.5) * Math.PI // Full celestial sphere
      pGroup.position.set(
        pData.dist * Math.cos(phi) * Math.cos(theta),
        pData.dist * Math.sin(phi),
        pData.dist * Math.cos(phi) * Math.sin(theta)
      )
      
      this.planets.add(pGroup)
    })

    this.add(this.planets)

    // 3. Constellations (Connecting nearby stars)
    const constGeo = new THREE.BufferGeometry()
    const constPoints: number[] = []
    
    // Pick random stars, find a nearby neighbor, connect them
    for(let i=0; i<150; i++) {
        const idx1 = Math.floor(Math.random() * 4000)
        const p1 = new THREE.Vector3(starCoords[idx1*3], starCoords[idx1*3+1], starCoords[idx1*3+2])
        
        let closestDist = Infinity
        let closestIdx = -1
        
        // simple brute force finding neighbor
        for(let j=0; j<100; j++) {
            const idx2 = Math.floor(Math.random() * 4000)
            if (idx1 === idx2) continue
            const p2 = new THREE.Vector3(starCoords[idx2*3], starCoords[idx2*3+1], starCoords[idx2*3+2])
            const d = p1.distanceTo(p2)
            if (d < closestDist && d < 60) {
                closestDist = d
                closestIdx = idx2
            }
        }
        
        if (closestIdx !== -1) {
            constPoints.push(
                p1.x, p1.y, p1.z,
                starCoords[closestIdx*3], starCoords[closestIdx*3+1], starCoords[closestIdx*3+2]
            )
        }
    }
    
    constGeo.setAttribute('position', new THREE.Float32BufferAttribute(constPoints, 3))
    const constMat = new THREE.LineBasicMaterial({
        color: 0x88ccff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false
    })
    this.constellations = new THREE.LineSegments(constGeo, constMat)
    this.add(this.constellations)
  }

  public update(playerPosition: THREE.Vector3, sunAltitude: number, time: number) {
    this.position.copy(playerPosition)
    
    // Fade in entirely as sun goes below horizon (-0.1 to -0.3)
    const targetOpacity = Math.min(1, Math.max(0, (-sunAltitude - 0.05) * 5))

    // Apply Opacities
    ;(this.stars.material as THREE.PointsMaterial).opacity = targetOpacity * 0.9
    ;(this.constellations.material as THREE.LineBasicMaterial).opacity = targetOpacity * 0.35
    
    this.planets.children.forEach(pGroup => {
        pGroup.children.forEach(mesh => {
            // @ts-ignore
            mesh.material.opacity = targetOpacity * 0.8
        })
    })

    // Fantasy Parallax
    // The stars drift very slowly
    this.stars.rotation.y = time * 0.00005
    this.stars.rotation.x = time * 0.00002
    
    this.constellations.rotation.copy(this.stars.rotation)

    // The planets orbit at different, visible speeds across the stellar background
    this.planets.rotation.y = time * 0.00015
    this.planets.rotation.z = time * 0.00005
  }
}
